import * as Knex from 'knex';
import Bluebird from 'bluebird';

import {INamesConfig, UnPromisify, INamesForTablesAndColumns, IRevisionInput} from '../types';
import {setNames} from '../sqlNames';
import nodeToSql from 'transformers/nodeToSql';

export interface IVersionRecorderExtractors<Resolver extends (...args: any[]) => any> {
    userId: (
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => string;
    userRoles: (
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => string[];
    revisionData: (
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => string;
    revisionTime?: (
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => string;
    knex: (
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => Knex;
    nodeId: (
        node: UnPromisify<ReturnType<Resolver>>,
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => string | number | undefined; // tslint:disable-line
    nodeSchemaVersion: number;
    nodeName: string;
    resolverOperation?: string;
    passThroughTransaction?: boolean;
    currentNodeSnapshot: (nodeId: string | number, resolverArgs: Parameters<Resolver>) => any; // tslint:disable-line
    currentNodeSnapshotFrequency?: number;
    parentNode?: (
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => {nodeId: string | number; nodeName: string};
    edges?: (
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => Array<{nodeId: string | number; nodeName: string}>;
}

interface ICreateRevisionTransactionConfig extends INamesConfig {
    transactionTimeoutSeconds: number;
}

const findOrCreateKnexTransaction = async (knex: Knex) => {
    return await knex.transaction();
};

const createRevisionTransaction = (
    config?: ICreateRevisionTransactionConfig & INamesConfig
) => async (transaction: Knex.Transaction, input: IRevisionInput) => {
    const nodeToSqlNameMappings = setNames(config || {});

    const {userRoles, ...mainTableInput} = input;
    const sqlData = nodeToSql(nodeToSqlNameMappings, mainTableInput);

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

    return revisionId;
};

const getResolverOperation = <T extends (...args: any[]) => any>(
    extractors: IVersionRecorderExtractors<T>,
    property: string | symbol
) => {
    const rawResolverOperation = extractors.resolverOperation
        ? extractors.resolverOperation
        : property;

    return typeof rawResolverOperation === 'symbol'
        ? rawResolverOperation.toString()
        : rawResolverOperation;
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

        // tslint:disable-next-line
        descriptor.value = (async (...args: Parameters<ResolverT>) => {
            const localKnexClient = extractors.knex(args[0], args[1], args[2], args[3]);
            const userId = extractors.userId(args[0], args[1], args[2], args[3]);
            const revisionData = extractors.revisionData(args[0], args[1], args[2], args[3]);
            const nodeSchemaVersion = extractors.nodeSchemaVersion;
            const nodeName = extractors.nodeName;
            const snapshotFrequency = extractors.currentNodeSnapshotFrequency
                ? extractors.currentNodeSnapshotFrequency
                : 1;

            const userRoles = extractors.userRoles
                ? extractors.userRoles(args[0], args[1], args[2], args[3])
                : [];
            const revisionTime = extractors.revisionTime
                ? extractors.revisionTime(args[0], args[1], args[2], args[3])
                : new Date()
                      .toISOString()
                      .split('Z')
                      .join('');

            const resolverOperation = getResolverOperation(extractors, property);

            const edgesToRecord = extractors.edges
                ? extractors.edges(args[0], args[1], args[2], args[3])
                : undefined;

            const transaction = await findOrCreateKnexTransaction(localKnexClient);

            const [parent, ar, ctx, info] = args;
            let newArgs = {};
            if (extractors.passThroughTransaction && extractors.passThroughTransaction === true) {
                newArgs = {...ar, transaction};
            } else {
                newArgs = {...ar};
            }
            const node = (await value(parent, newArgs, ctx, info)) as UnPromisify<
                ReturnType<ResolverT>
            >;

            const nodeId = extractors.nodeId(node, args[0], args[1], args[2], args[3]);
            if (nodeId === undefined) {
                throw new Error(
                    `Unable to extract node id in version recorder for node ${nodeName}`
                );
            }

            const revisionInput = {
                userId,
                userRoles,
                revisionData,
                revisionTime,
                nodeSchemaVersion,
                nodeName,
                nodeId,
                resolverOperation
            };

            const revTxFn = createRevisionTransaction(config);
            const revisionId = await revTxFn(transaction, revisionInput);

            const shouldStoreSnapshot = await findIfShouldStoreSnapshot(
                {tableNames, columnNames},
                snapshotFrequency,
                transaction,
                nodeId,
                nodeName,
                nodeSchemaVersion
            );

            if (shouldStoreSnapshot) {
                let currentNodeSnapshot;
                try {
                    currentNodeSnapshot = await extractors.currentNodeSnapshot(
                        nodeId,
                        args as Parameters<ResolverT>
                    );
                } catch (e) {
                    console.log('EERRRROR', e);
                }

                await storeCurrentNodeSnapshot(
                    {tableNames, columnNames},
                    currentNodeSnapshot,
                    revisionId,
                    transaction
                );
            }

            if (edgesToRecord) {
                await Bluebird.each(edgesToRecord, async edge => {
                    return await storeEdge(
                        {tableNames, columnNames},
                        edge,
                        revisionInput,
                        transaction
                    );
                });
            }
            await transaction.commit();

            return node;
        }) as ResolverT;

        return descriptor;
    };
};

const storeEdge = async (
    {tableNames, columnNames}: INamesForTablesAndColumns,
    edgesToRecord: {nodeId: string | number; nodeName: string},
    revisionInput: IRevisionInput,
    transaction: Knex.Transaction
) => {
    const inputFirst = {
        [columnNames.revisionEdgeTime]: revisionInput.revisionTime,
        [columnNames.resolverOperation]: revisionInput.resolverOperation,
        [columnNames.edgeNodeIdA]: revisionInput.nodeId,
        [columnNames.edgeNodeNameA]: revisionInput.nodeName,
        [columnNames.edgeNodeIdB]: edgesToRecord.nodeId,
        [columnNames.edgeNodeNameB]: edgesToRecord.nodeName
    };

    // switch A and B nodes for faster sql querying
    const inputSecond = {
        [columnNames.revisionEdgeTime]: revisionInput.revisionTime,
        [columnNames.resolverOperation]: revisionInput.resolverOperation,
        [columnNames.edgeNodeIdB]: revisionInput.nodeId,
        [columnNames.edgeNodeNameB]: revisionInput.nodeName,
        [columnNames.edgeNodeIdA]: edgesToRecord.nodeId,
        [columnNames.edgeNodeNameA]: edgesToRecord.nodeName
    };

    await transaction.table(tableNames.revisionEdge).insert(inputFirst);
    await transaction.table(tableNames.revisionEdge).insert(inputSecond);
};
/**
 * Write the node snapshot to the database
 */
const storeCurrentNodeSnapshot = async (
    {tableNames, columnNames}: INamesForTablesAndColumns,
    currentNodeSnapshot: any,
    revisionId: string | number,
    transaction: Knex.Transaction
) => {
    await transaction.table(tableNames.revisionNodeSnapshot).insert({
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
    transaction: Knex.Transaction,
    nodeId: number | string,
    nodeName: string,
    mostRecentNodeSchemaVersion: number
) => {
    const sql = transaction
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
