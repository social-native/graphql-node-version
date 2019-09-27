import * as Knex from 'knex';

import {
    INamesConfig,
    UnPromisify,
    // IRevisionInfo,
    INamesForTablesAndColumns,
    IRevisionInput
} from '../types';
import {setNames} from '../sqlNames';
import nodeToSql from 'transformers/nodeToSql';

export interface IVersionRecorderExtractors<Resolver extends (...args: any[]) => any> {
    userId: (...args: Parameters<Resolver>) => string;
    userRoles: (...args: Parameters<Resolver>) => string[];
    revisionData: (...args: Parameters<Resolver>) => string;
    revisionTime?: (...args: Parameters<Resolver>) => string;
    nodeSchemaVersion: (...args: Parameters<Resolver>) => number;
    nodeName: (...args: Parameters<Resolver>) => string;
    knex: (...args: Parameters<Resolver>) => Knex;
    resolverName?: (...args: Parameters<Resolver>) => string;
    nodeIdUpdate?: (...args: Parameters<Resolver>) => string | number;
    nodeIdCreate?: (node: UnPromisify<ReturnType<Resolver>>) => string | number; // tslint:disable-line
    currentNodeSnapshot: (nodeId: string | number, resolverArgs: Parameters<Resolver>) => any; // tslint:disable-line
    currentNodeSnapshotFrequency?: number;
}

interface ICreateRevisionTransactionConfig extends INamesConfig {
    transactionTimeoutSeconds: number;
}

const createRevisionTransaction = (
    config?: ICreateRevisionTransactionConfig & INamesConfig
) => async (
    knex: Knex,
    input: IRevisionInput
): Promise<{transaction: Knex.Transaction; revisionId: number}> => {
    const nodeToSqlNameMappings = setNames(config || {});

    const {userRoles, ...mainTableInput} = input;
    const sqlData = nodeToSql(nodeToSqlNameMappings, mainTableInput);

    const transaction = await knex.transaction();
    const revisionId = ((await transaction
        .table(nodeToSqlNameMappings.tableNames.revision)
        .insert(sqlData)
        .returning('id')) as number[])[0];

    const roles = userRoles || [];

    // calculate which role are missing in the db
    const foundRoleNames = await transaction
        .table(nodeToSqlNameMappings.tableNames.revisionRole)
        .whereIn(nodeToSqlNameMappings.columnNames.roleName, roles);
    const foundRoles = foundRoleNames.map(
        (n: any) => n[nodeToSqlNameMappings.columnNames.roleName]
    );
    const missingRoles = roles.filter(i => foundRoles.indexOf(i) < 0);

    // insert the missing roles
    await transaction.table(nodeToSqlNameMappings.tableNames.revisionRole).insert(
        missingRoles.map((role: string) => ({
            [nodeToSqlNameMappings.columnNames.roleName]: role
        }))
    );

    // select the role ids
    const ids = (await transaction
        .table(nodeToSqlNameMappings.tableNames.revisionRole)
        .whereIn(nodeToSqlNameMappings.columnNames.roleName, roles)) as Array<{id: number}>;

    // insert roles ids associated with the revision id
    await transaction.table(nodeToSqlNameMappings.tableNames.revisionUserRole).insert(
        ids.map(({id}) => ({
            [`${nodeToSqlNameMappings.tableNames.revisionRole}_id`]: id,
            [`${nodeToSqlNameMappings.tableNames.revision}_id`]: revisionId
        }))
    );

    setTimeout(async () => {
        await transaction.rollback();
        // throw new Error('Detected an orphaned transaction');
    }, ((config && config.transactionTimeoutSeconds) || 10) * 1000);

    return {transaction, revisionId};
};

export default <ResolverT extends (...args: any[]) => any>(
    extractors: IVersionRecorderExtractors<ResolverT>,
    config?: ICreateRevisionTransactionConfig & INamesConfig
): MethodDecorator => {
    return (_target, property, descriptor: TypedPropertyDescriptor<any>) => {
        const {tableNames, columnNames} = setNames(config || {});
        const {value} = descriptor;
        if (typeof value !== 'function') {
            throw new TypeError('Only functions can be decorated.');
        }

        if (!extractors.nodeIdCreate && !extractors.nodeIdUpdate) {
            throw new Error(
                // tslint:disable-next-line
                'No node id extractor specified in the config. You need to specify either a `nodeIdUpdate` or `nodeIdCreate` extractor'
            );
        }

        // tslint:disable-next-line
        descriptor.value = (async (...args) => {
            const localKnexClient = extractors.knex(...(args as Parameters<ResolverT>));
            const userId = extractors.userId(...(args as Parameters<ResolverT>));
            const revisionData = extractors.revisionData(...(args as Parameters<ResolverT>));
            const nodeSchemaVersion = extractors.nodeSchemaVersion(
                ...(args as Parameters<ResolverT>)
            );
            const nodeName = extractors.nodeName(...(args as Parameters<ResolverT>));
            const snapshotFrequency = extractors.currentNodeSnapshotFrequency
                ? extractors.currentNodeSnapshotFrequency
                : 1;

            const userRoles = extractors.userRoles
                ? extractors.userRoles(...(args as Parameters<ResolverT>))
                : [];
            const revisionTime = extractors.revisionTime
                ? extractors.revisionTime(...(args as Parameters<ResolverT>))
                : new Date()
                      .toISOString()
                      .split('Z')
                      .join('');
            let nodeId = extractors.nodeIdUpdate
                ? extractors.nodeIdUpdate(...(args as Parameters<ResolverT>))
                : undefined;
            const resolverName = extractors.resolverName
                ? extractors.resolverName(...(args as Parameters<ResolverT>))
                : property;

            // if (nodeId === undefined) {
            //     throw new Error('Could not extract node id for version recording');
            // }

            const revisionInput = {
                userId,
                userRoles,
                revisionData,
                revisionTime,
                nodeSchemaVersion,
                nodeName,
                nodeId,
                resolverName:
                    typeof resolverName === 'symbol' ? resolverName.toString() : resolverName
            };

            console.log('CREATING TRANSACTION');
            const revTxFn = createRevisionTransaction(config);
            const {transaction, revisionId} = await revTxFn(localKnexClient, revisionInput);

            const [parent, ar, ctx, info] = args;
            const newArgs = {...ar, transaction};
            const node = (await value(parent, newArgs, ctx, info)) as UnPromisify<
                ReturnType<ResolverT>
            >;
            console.log('NODE', node);

            if (!nodeId) {
                nodeId = extractors.nodeIdCreate ? extractors.nodeIdCreate(node) : undefined;

                if (nodeId === undefined) {
                    throw new Error(
                        `Unable to extract node id in version recorder for node ${nodeName}`
                    );
                }
                await localKnexClient
                    .table(tableNames.revision)
                    .update({[columnNames.nodeId]: nodeId})
                    .where({id: revisionId});
            }
            const shouldStoreSnapshot = await findIfShouldStoreSnapshot(
                {tableNames, columnNames},
                snapshotFrequency,
                localKnexClient,
                nodeId,
                nodeName,
                nodeSchemaVersion
            );
            console.log('SHOUOLD STORE SNAPSHOT', shouldStoreSnapshot);
            console.log('NODE ID', nodeId);

            if (shouldStoreSnapshot) {
                // console.log('THESE ARGS', args);
                let currentNodeSnapshot;
                try {
                    currentNodeSnapshot = await extractors.currentNodeSnapshot(
                        nodeId,
                        args as Parameters<ResolverT>
                    );
                } catch (e) {
                    console.log('EERRRROR', e);
                }
                console.log('CURRENT NODE SNAPSHOT', currentNodeSnapshot);

                // (
                //     ...(args as Parameters<ResolverT>)
                // );

                await storeCurrentNodeSnapshot(
                    {tableNames, columnNames},
                    currentNodeSnapshot,
                    revisionId,
                    localKnexClient
                );
            }
            return node;
        }) as ResolverT;

        return descriptor;
    };
};

/**
 * Write the node snapshot to the database
 */
const storeCurrentNodeSnapshot = async (
    {tableNames, columnNames}: INamesForTablesAndColumns,
    currentNodeSnapshot: any,
    revisionId: string | number,
    localKnexClient: Knex
) => {
    await localKnexClient.table(tableNames.revisionNodeSnapshot).insert({
        [`${tableNames.revision}_${columnNames.revisionId}`]: revisionId,
        [columnNames.snapshotData]: JSON.stringify(currentNodeSnapshot) // tslint:disable-line
    });
};

/**
 * Fetch the number of full node snapshots for the node id and node schema version
 * If a snapshot exists within the expected snapshot frequency, then we don't need to take another snapshot
 */
const findIfShouldStoreSnapshot = async (
    {tableNames, columnNames}: INamesForTablesAndColumns,
    snapshotFrequency: number,
    localKnexClient: Knex,
    nodeId: number | string,
    nodeName: string,
    mostRecentNodeSchemaVersion: number
) => {
    const sql = localKnexClient
        .table(tableNames.revision)
        .leftJoin(
            tableNames.revisionNodeSnapshot,
            `${tableNames.revision}.${columnNames.revisionId}`,
            `${tableNames.revisionNodeSnapshot}.${tableNames.revision}_${columnNames.revisionId}`
        )
        .where({
            [`${tableNames.revision}.${columnNames.nodeName}`]: nodeName,
            [`${tableNames.revision}.${columnNames.nodeId}`]: nodeId,
            [`${tableNames.revision}.${columnNames.nodeSchemaVersion}`]: mostRecentNodeSchemaVersion
        })
        .orderBy(`${tableNames.revision}.${columnNames.revisionTime}`, 'desc')
        .limit(snapshotFrequency)
        .select(
            `${tableNames.revision}.${columnNames.revisionTime} as revision_creation`,
            `${tableNames.revisionNodeSnapshot}.${columnNames.snapshotTime} as snapshot_creation`
        );

    const snapshots = (await sql) as Array<{
        revision_creation?: string;
        snapshot_creation?: string;
    }>;
    const snapshotWithinFrequencyRange = !!snapshots.find(data => data.snapshot_creation);

    return !snapshotWithinFrequencyRange;
};
