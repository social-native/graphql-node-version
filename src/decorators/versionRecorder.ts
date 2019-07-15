import * as Knex from 'knex';

import {INamesConfig, UnPromisify, IRevisionInfo} from '../types';
import {setNames} from '../sqlNames';
import nodeToSql from 'transformers/nodeToSql';

export interface IVersionRecorderExtractors<Resolver extends (...args: any[]) => any> {
    userId: (...args: Parameters<Resolver>) => string;
    userRoles: (...args: Parameters<Resolver>) => string[];
    revisionData: (...args: Parameters<Resolver>) => string;
    revisionTime?: (...args: Parameters<Resolver>) => string;
    nodeVersion: (...args: Parameters<Resolver>) => number;
    nodeName: (...args: Parameters<Resolver>) => string;
    knex: (...args: Parameters<Resolver>) => Knex;
    resolverName?: (...args: Parameters<Resolver>) => string;
    nodeIdUpdate?: (...args: Parameters<Resolver>) => string | number;
    nodeIdCreate?: (node: UnPromisify<ReturnType<Resolver>>) => string | number; // tslint:disable-line
}

interface ICreateRevisionTransactionConfig extends INamesConfig {
    transactionTimeoutSeconds: number;
}

const createRevisionTransaction = (
    config?: ICreateRevisionTransactionConfig & INamesConfig
) => async (
    knex: Knex,
    input: IRevisionInfo
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
            const nodeVersion = extractors.nodeVersion(...(args as Parameters<ResolverT>));
            const nodeName = extractors.nodeName(...(args as Parameters<ResolverT>));
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

            const revisionInput = {
                userId,
                userRoles,
                revisionData,
                revisionTime,
                nodeVersion,
                nodeName,
                nodeId,
                resolverName:
                    typeof resolverName === 'symbol' ? resolverName.toString() : resolverName
            };

            const revTxFn = createRevisionTransaction(config);
            const {transaction, revisionId} = await revTxFn(localKnexClient, revisionInput);

            const [parent, ar, ctx, info] = args;
            const newArgs = {...ar, transaction};
            const node = (await value(parent, newArgs, ctx, info)) as UnPromisify<
                ReturnType<ResolverT>
            >;

            if (!nodeId) {
                nodeId = extractors.nodeIdCreate ? extractors.nodeIdCreate(node) : undefined;
                await localKnexClient
                    .table(tableNames.revision)
                    .update({[columnNames.nodeId]: nodeId})
                    .where({id: revisionId});
            }

            return node;
        }) as ResolverT;

        return descriptor;
    };
};
