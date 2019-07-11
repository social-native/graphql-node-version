import * as Knex from 'knex';
import {UnPromisify, IRevisionInfo, INamesConfig} from '../types';
import {
    ConnectionManager,
    IInputArgs
    // typeDefs as connectionTypeDefs,
    // resolvers as connectionResolvers,
    // IQueryResult
} from 'snpkg-snapi-connections';
import {setNames} from 'columnNames';

export interface IVersionConnectionExtractors<Resolver extends (...args: any[]) => any> {
    knex: (...args: Parameters<Resolver>) => Knex;
    nodeBuilder?: (
        previousModel: UnPromisify<ReturnType<Resolver>>,
        versionInfo: IRevisionInfo
    ) => UnPromisify<ReturnType<Resolver>>;
}

export default <ResolverT extends (...args: any[]) => any>(
    extractors: IVersionConnectionExtractors<ResolverT>,
    config?: INamesConfig
): MethodDecorator => {
    return (_target, _property, descriptor: TypedPropertyDescriptor<any>) => {
        const {tableNames, columnNames} = setNames(config || {});
        const {value} = descriptor;
        if (typeof value !== 'function') {
            throw new TypeError('Only functions can be decorated.');
        }

        // if (!extractors.nodeIdCreate && !extractors.nodeIdUpdate) {
        //     throw new Error(
        //         // tslint:disable-next-line
        //         'No node id extractor specified in the config. You need to specify either a `nodeIdUpdate` or `nodeIdCreate` extractor'
        //     );
        // }

        // tslint:disable-next-line
        descriptor.value = (async (...args) => {
            const localKnexClient =
                extractors.knex && extractors.knex(...(args as Parameters<ResolverT>));
            // console.log(localKnexClient);
            // const userId =
            //     extractors.userId && extractors.userId(...(args as Parameters<ResolverT>));
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
            const {nodeId, revisionData} = columnNames;
            // const newArgs = {...ar, transaction};
            const node = (await value(parent, ar, ctx, info)) as UnPromisify<ReturnType<ResolverT>>;
            const revisionsInRange = await getRevisionsInRange(
                ar,
                localKnexClient,
                tableNames,
                columnNames,
                {
                    nodeId,
                    revisionData
                }
            );
            console.log(revisionsInRange);
            // const revisionsOfInterest = await getRevisionsOfInterest(ar, localKnexClient);
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

const transformSqlToNode = ({
    columnNames,
    columnData
}: {
    columnNames: {[column: string]: string};
    columnData: {[column: string]: any};
}) => {
    const inverseColumnNames = Object.keys(columnNames || {}).reduce(
        (inverseColumnNamesObj, nodeName) => {
            const sqlName = columnNames[nodeName];
            inverseColumnNamesObj[sqlName] = nodeName;
            return inverseColumnNamesObj;
        },
        {} as {[column: string]: string}
    );

    return Object.keys(inverseColumnNames || {}).reduce(
        (newColumnDataObj, sqlName) => {
            const nodeName = inverseColumnNames[sqlName];
            const data = columnData[sqlName];
            if (data) {
                newColumnDataObj[nodeName] = data;
            }
            return newColumnDataObj;
        },
        {} as IRevisionInfo & {[column: string]: any}
    );
};

const getRevisionsInRange = async (
    {id, ...inputArgs}: IInputArgs & {id: string},
    knex: Knex,
    // TODO reuse types
    tableNames: {revision: string},
    columnNames: {nodeId: string; revisionData: string},
    // TODO reuse types
    attributeMap: {nodeId: string; revisionData: string}
) => {
    const nodeConnection = new ConnectionManager<typeof attributeMap>(inputArgs, attributeMap, {
        resultOptions: {
            nodeTransformer: (node: any) => ({
                ...(transformSqlToNode({columnNames, columnData: node}) as any),
                id: node.id
            })
        }
    });
    const queryBuilder = knex
        .queryBuilder()
        .table(tableNames.revision)
        .where({[columnNames.nodeId]: id})
        .select(Object.values(attributeMap), 'id');

    console.log(queryBuilder.toSQL());
    const result = await nodeConnection.createQuery(queryBuilder);

    nodeConnection.addResult(result);
    return nodeConnection.edges.map(({node}) => node.revisionData);
};
