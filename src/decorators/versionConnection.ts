import * as Knex from 'knex';
import {
    UnPromisify,
    IRevisionInfo,
    INamesConfig,
    INamesForTablesAndColumns,
    ResolverArgs
} from '../types';
import {
    ConnectionManager
    // IInputArgs
    // typeDefs as connectionTypeDefs,
    // resolvers as connectionResolvers,
    // IQueryResult
} from 'snpkg-snapi-connections';
import {setNames} from 'columnNames';
import sqlToNode from 'transformers/sqlToNode';

export interface IVersionConnectionExtractors<Resolver extends (...args: any[]) => any> {
    knex: (...args: Parameters<Resolver>) => Knex;
    nodeBuilder?: (
        previousModel: UnPromisify<ReturnType<Resolver>>,
        versionInfo: IRevisionInfo
    ) => UnPromisify<ReturnType<Resolver>>;
    nodeId?: (...args: ResolverArgs<Resolver>) => string;
}

export default <ResolverT extends (...args: any[]) => any>(
    extractors: IVersionConnectionExtractors<ResolverT>,
    config?: INamesConfig
): MethodDecorator => {
    return (_target, _property, descriptor: TypedPropertyDescriptor<any>) => {
        // const {tableNames, columnNames}
        const nodeToSqlNameMappings = setNames(config || {});
        const {value} = descriptor;
        if (typeof value !== 'function') {
            throw new TypeError('Only functions can be decorated.');
        }

        // if (!extractors.nodeIdCreate && !extractors.nodeIdUpdate) {
        //     throw new Error(
        //         // tslint:disable-next-line
        //         `No node id extractor specified in the config.
        // You need to specify either a 'nodeIdUpdate' or `nodeIdCreate` extractor`
        //     );
        // }

        // tslint:disable-next-line
        descriptor.value = (async (...args) => {
            const localKnexClient =
                extractors.knex && extractors.knex(...(args as Parameters<ResolverT>));
            // console.log(localKnexClient);
            // TODO complete nodeId
            // const nodeId = extractors.nodeId
            //     ? extractors.nodeId(...(args as Parameters<ResolverT>))
            //     : args.args.id;
            // const userRoles = extractors.userRoles
            //     ? extractors.userRoles(...(args as Parameters<ResolverT>))
            //     : [];
            // const revisionData =
            //     extractors.revisionData &&
            //     extractors.revisionData(...(args as Parameters<ResolverT>));
            // const revisionTime = extractors.revisionTime
            //     ? extractors.revisionTime(...(args as Parameters<ResolverT>))
            //     : new Date()
            //           .toISOString()
            //           .split('Z')
            //           .join('');
            // const nodeVersion =
            //     extractors.nodeVersion &&
            //     extractors.nodeVersion(...(args as Parameters<ResolverT>));
            // const nodeName = extractors.nodeName
            //     ? extractors.nodeName(...(args as Parameters<ResolverT>))
            //     : property;
            // let nodeId = extractors.nodeIdUpdate
            //     ? extractors.nodeIdUpdate(...(args as Parameters<ResolverT>))
            //     : undefined;

            // const revisionInput = {
            //     userId,
            //     userRoles,
            //     revisionData,
            //     revisionTime,
            //     nodeVersion,
            //     nodeName: typeof nodeName === 'symbol' ? nodeName.toString() : nodeName,
            //     nodeId
            // };

            // const revTxFn = createRevisionTransaction(config);
            // const {transaction, revisionId} = await revTxFn(localKnexClient, revisionInput);

            const [parent, ar, ctx, info] = args;
            // const newArgs = {...ar, transaction};
            const node = (await value(parent, ar, ctx, info)) as UnPromisify<ReturnType<ResolverT>>;
            const revisionsInRange = await getRevisionsInRange(
                ar,
                localKnexClient,
                nodeToSqlNameMappings,
                extractors
            );
            console.log(revisionsInRange);
            const revisionsOfInterest = await getRevisionsOfInterest(
                ar,
                localKnexClient,
                nodeToSqlNameMappings,
                extractors
            );
            console.log(revisionsOfInterest);
            // const nodes = createRevisionNodes(revisionsInRange, revisionsOfInterest);

            // if (!nodeId) {
            //     nodeId = extractors.nodeIdCreate ? extractors.nodeIdCreate(node) : undefined;
            //     await localKnexClient
            //         .table(tableNames.revision)
            //         .update({[columnNames.nodeId]: nodeId})
            //         .where({id: revisionId});
            // }

            return node;
        }) as ResolverT;

        return descriptor;
    };
};

const getRevisionsInRange = async <ResolverT extends (...args: any[]) => any>(
    inputArgs: ResolverArgs<ResolverT>, // IInputArgs & {[inputArg: string]: number | string},
    knex: Knex,
    nodeToSqlNameMappings: INamesForTablesAndColumns,
    extractors: IVersionConnectionExtractors<ResolverT>
) => {
    const {
        id: idName,
        nodeId: nodeIdName,
        revisionData: revisionDataName
    } = nodeToSqlNameMappings.columnNames;
    const attributeMap = {id: idName, nodeId: nodeIdName, revisionData: revisionDataName};

    const nodeConnection = new ConnectionManager<typeof attributeMap>({}, attributeMap, {
        resultOptions: {
            nodeTransformer: node => sqlToNode(nodeToSqlNameMappings, node)
        }
    });

    const nodeId = extractors.nodeId ? extractors.nodeId(...inputArgs) : inputArgs.id;
    const queryBuilder = knex
        .queryBuilder()
        .table(nodeToSqlNameMappings.tableNames.revision)
        .where({[nodeToSqlNameMappings.columnNames.nodeId]: nodeId})
        .select(...Object.values(attributeMap));

    const result = await nodeConnection.createQuery(queryBuilder);

    nodeConnection.addResult(result);
    return nodeConnection.edges.map(({node}) => node);
};

const getRevisionsOfInterest = async <ResolverT extends (...args: any[]) => any>(
    inputArgs: ResolverArgs<ResolverT>, // IInputArgs & {[inputArg: string]: number | string},
    knex: Knex,
    nodeToSqlNameMappings: INamesForTablesAndColumns,
    extractors: IVersionConnectionExtractors<ResolverT>
) => {
    // // const {
    // //     id: idName,
    // //     nodeId: nodeIdName,
    // //     revisionData: revisionDataName
    // } = nodeToSqlNameMappings.columnNames;
    // const attributeMap = {id: idName, nodeId: nodeIdName, revisionData: revisionDataName};
    const attributeMap = nodeToSqlNameMappings.columnNames;
    const nodeConnection = new ConnectionManager<typeof attributeMap>(inputArgs, attributeMap, {
        resultOptions: {
            nodeTransformer: node => sqlToNode(nodeToSqlNameMappings, node)
        }
    });

    const nodeId = extractors.nodeId ? extractors.nodeId(...inputArgs) : inputArgs.id;
    const queryBuilder = knex
        .queryBuilder()
        .table(nodeToSqlNameMappings.tableNames.revision)
        .leftJoin(
            nodeToSqlNameMappings.tableNames.revisionUserRole,
            `${nodeToSqlNameMappings.tableNames.revisionUserRole}.${nodeToSqlNameMappings.tableNames.revision}_id`,
            `${nodeToSqlNameMappings.columnNames.id}`
        )
        .leftJoin(
            nodeToSqlNameMappings.tableNames.revisionRole,
            `${nodeToSqlNameMappings.tableNames.revisionUserRole}.${nodeToSqlNameMappings.tableNames.revisionRole}_id`,
            `${nodeToSqlNameMappings.tableNames.revisionRole}.id`
        )
        .where({[nodeToSqlNameMappings.columnNames.nodeId]: nodeId})
        .select(...Object.values(attributeMap));

    console.log(queryBuilder.toSQL());
    const result = await nodeConnection.createQuery(queryBuilder);

    nodeConnection.addResult(result);
    return nodeConnection.edges.map(({node}) => node);
};
