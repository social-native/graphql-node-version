import * as Knex from 'knex';
import {
    UnPromisify,
    IRevisionInfo,
    INamesConfig,
    INamesForTablesAndColumns,
    ResolverArgs,
    Unpacked
} from '../types';
import {ConnectionManager} from 'snpkg-snapi-connections';
import {setNames} from 'columnNames';

export interface IVersionConnectionExtractors<Resolver extends (...args: any[]) => any> {
    knex: (...args: Parameters<Resolver>) => Knex;
    nodeBuilder: (
        previousModel: UnPromisify<ReturnType<Resolver>>,
        versionInfo: Partial<IRevisionInfo>
    ) => UnPromisify<ReturnType<Resolver>>;
    nodeId?: (...args: ResolverArgs<Resolver>) => string;
}

export default <ResolverT extends (...args: any[]) => any>(
    extractors: IVersionConnectionExtractors<ResolverT>,
    config?: INamesConfig
): MethodDecorator => {
    return (_target, _property, descriptor: TypedPropertyDescriptor<any>) => {
        const nodeToSqlNameMappings = setNames(config || {});
        const {value} = descriptor;
        if (typeof value !== 'function') {
            throw new TypeError('Only functions can be decorated.');
        }

        // tslint:disable-next-line
        descriptor.value = (async (...args) => {
            const localKnexClient =
                extractors.knex && extractors.knex(...(args as Parameters<ResolverT>));

            const [parent, ar, ctx, info] = args;
            const node = (await value(parent, ar, ctx, info)) as UnPromisify<ReturnType<ResolverT>>;

            const revisionsInRange = await getRevisionsInRange(
                ar,
                localKnexClient,
                nodeToSqlNameMappings,
                extractors
            );

            const versionEdges = revisionsInRange.reduce(
                (edges, version, index) => {
                    let edge;
                    if (index === 0) {
                        edge = {
                            version,
                            node: extractors.nodeBuilder(node, version)
                        };
                    } else {
                        const previousNode = edges[index - 1].node;
                        edge = {
                            version,
                            node: extractors.nodeBuilder(previousNode, version)
                        };
                    }
                    return [...edges, edge];
                },
                [] as Array<{node: typeof node; version: Unpacked<typeof revisionsInRange>}>
            );

            const versionEdgesObj = versionEdges.reduce(
                (obj, edge) => {
                    obj[edge.version.nodeId] = edge;
                    return obj;
                },
                {} as {[nodeId: string]: Unpacked<typeof versionEdges>}
            );

            const connectionNode = await getRevisionsOfInterest(
                ar,
                localKnexClient,
                nodeToSqlNameMappings,
                extractors
            );

            const rolesByRevisionId = connectionNode.edges.reduce(
                (rolesObj, edge) => {
                    const {id, roleName} = edge.node;
                    const roleNames = rolesObj[id] || [];

                    rolesObj[id] = [...roleNames, roleName];
                    return rolesObj;
                },
                {} as {[revisionId: string]: string[]}
            );
            const edgesOfInterestObj = connectionNode.edges.reduce(
                (edgeObj, edge) => {
                    const {node: fullNode} = versionEdgesObj[edge.node.nodeId];
                    const version = edge.node;
                    const {revisionData, id: versionId} = version;
                    const newVersion = {
                        ...version,
                        userRoles: rolesByRevisionId[versionId],
                        revisionData:
                            typeof revisionData === 'string'
                                ? revisionData
                                : JSON.stringify(revisionData)
                    };
                    edgeObj[versionId] = {...edge, node: fullNode, version: newVersion};
                    return edgeObj;
                },
                {} as {
                    [versionId: string]: {
                        cursor: string;
                        node: Unpacked<typeof versionEdges>;
                        version: Unpacked<typeof connectionNode.edges>['node'];
                    };
                    node: any;
                }
            );
            console.log(edgesOfInterestObj);

            const edgesOfInterest = [...Object.keys(rolesByRevisionId)].map(
                id => edgesOfInterestObj[id]
            );

            return {...connectionNode, edges: edgesOfInterest};
        }) as ResolverT;

        return descriptor;
    };
};

const getRevisionsInRange = async <ResolverT extends (...args: any[]) => any>(
    inputArgs: ResolverArgs<ResolverT>,
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

    const nodeConnection = new ConnectionManager<typeof attributeMap>({}, attributeMap);

    const nodeId = extractors.nodeId ? extractors.nodeId(...inputArgs) : inputArgs.id;
    const queryBuilder = knex
        .queryBuilder()
        .table(nodeToSqlNameMappings.tableNames.revision)
        .where({[nodeToSqlNameMappings.columnNames.nodeId]: nodeId})
        .select(attributeMap);
    const result = await nodeConnection.createQuery(queryBuilder);

    nodeConnection.addResult(result);
    return nodeConnection.edges.map(({node}) => node);
};

const getRevisionsOfInterest = async <ResolverT extends (...args: any[]) => any>(
    inputArgs: ResolverArgs<ResolverT>,
    knex: Knex,
    nodeToSqlNameMappings: INamesForTablesAndColumns,
    extractors: IVersionConnectionExtractors<ResolverT>
) => {
    const attributeMap = nodeToSqlNameMappings.columnNames;
    const nodeConnection = new ConnectionManager<typeof attributeMap>(inputArgs, attributeMap);

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
        .select(attributeMap);

    const result = await nodeConnection.createQuery(queryBuilder);

    nodeConnection.addResult(result);
    const {pageInfo, edges} = nodeConnection;
    return {pageInfo, edges};
};
