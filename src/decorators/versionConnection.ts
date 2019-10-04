import * as Knex from 'knex';
import {DateTime} from 'luxon';

import {
    UnPromisify,
    INamesConfig,
    INamesForTablesAndColumns,
    INodeBuilderRevisionInfo,
    IRevisionQueryResult,
    ILinkChange,
    IVersionConnection,
    Unpacked
} from '../types';
import {ConnectionManager, IQueryResult, IFilter} from '@social-native/snpkg-snapi-connections';

import {setNames} from 'sqlNames';

export interface IVersionConnectionExtractors<Resolver extends (...args: any[]) => any> {
    knex: Knex;
    nodeId: string;
    nodeName: string;
    nodeBuilder: (
        previousModel: UnPromisify<ReturnType<Resolver>>,
        versionInfo: INodeBuilderRevisionInfo
    ) => UnPromisify<ReturnType<Resolver>>;
}

/**
 * Logic:
 * 1. Get all revisions in range of connection
 * 2. Calculate full nodes for all revisions in range
 * 3. Get revisions in connection (filters may apply etc)
 */
export default <ResolverT extends (...args: [any, any, any, any]) => any>(
    extractors: IVersionConnectionExtractors<ResolverT>,
    config?: INamesConfig
): MethodDecorator => {
    return (_target, _property, descriptor: TypedPropertyDescriptor<any>) => {
        const {value} = descriptor;
        if (typeof value !== 'function') {
            throw new TypeError('Only functions can be decorated.');
        }

        // tslint:disable-next-line
        descriptor.value = (async (...args) => {
            const latestNode = (await value(args[0], args[1], args[2], args[3])) as UnPromisify<
                ReturnType<ResolverT>
            >;
            return createRevisionConnection<ResolverT>(
                latestNode,
                args as Parameters<ResolverT>,
                extractors,
                config
            );
        }) as ResolverT;

        return descriptor;
    };
};

export const createRevisionConnection = async <
    ResolverT extends (...args: [any, any, any, any]) => any
>(
    currentVersionNode: UnPromisify<ReturnType<ResolverT>>,
    resolverArgs: Parameters<ResolverT>,
    extractors: IVersionConnectionExtractors<ResolverT>,
    config?: INamesConfig
) => {
    // tslint:disable-next-line
    console.log('CURRENT NODE', currentVersionNode);
    const {knex} = extractors;
    // extractors.knex(resolverArgs[0], resolverArgs[1], resolverArgs[2], resolverArgs[3]);

    const nodeToSqlNameMappings = setNames(config || {});

    // Step 1. Get all revisions in the connection
    console.log('1. GETTING NODE CHANGE REVISIONS OF INTEREST');
    const nodeChangesOfInterest = await getNodeChangesOfInterest(
        resolverArgs as Parameters<ResolverT>,
        knex,
        nodeToSqlNameMappings,
        extractors
    );

    console.log('2. CHECK IF THERE ARE NO NODE CHANGE REVISIONS');
    // Step 2. If there are no revisions in the connection, return with no edges
    if (nodeChangesOfInterest.edges.length === 0) {
        const attributeMap = {
            ...nodeToSqlNameMappings.columnNames,
            id: `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
            revisionId: `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
            revisionTime: `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionTime}`,
            userRoles: `${nodeToSqlNameMappings.tableNames.revisionRole}.${nodeToSqlNameMappings.columnNames.roleName}`
        };

        const nodeConnection = new ConnectionManager<IRevisionQueryResult<number>>(
            resolverArgs[1],
            attributeMap,
            {
                builderOptions: {
                    filterTransformer: castUnixToDateTime
                },
                resultOptions: {
                    nodeTransformer: castNodeWithRevisionTimeInDateTimeToUnixSecs
                }
            }
        );
        nodeConnection.addResult([{}]);
        const {edges, pageInfo} = nodeConnection;
        const firstEdge = edges[0];
        return {pageInfo, edges: [{...firstEdge, nodeChange: undefined, node: currentVersionNode}]};
    }

    console.log('3. DETERMINING OLDEST REVISION ID');
    // Step 3. Determine the oldest revision with a full node snapshot
    const minRevision = await getMinRevisionNumberWithSnapshot(
        nodeChangesOfInterest,
        knex,
        nodeToSqlNameMappings
    );

    if (minRevision === undefined) {
        throw new Error('Missing min revision number');
    }

    const {revisionId: minRevisionNumber, revisionTime: minRevisionTimeInUnixSecs} = minRevision;

    console.log('4. GETTING ALL REVISIONS IN RANGE');
    // Step 4. Get all revisions in range from the newest revision of interest to the
    //   oldest revision with a snapshot
    const isUsingConnectionCursor = !!(
        resolverArgs[1] &&
        (resolverArgs[1].before || resolverArgs[1].after)
    );
    const {revisionId: maxRevisionNumber, revisionTime} = nodeChangesOfInterest.edges[0].node;
    const maxRevisionTimeInUnixSecs = isUsingConnectionCursor
        ? revisionTime
        : Math.ceil(DateTime.utc().toSeconds());

    const {nodeId, nodeName} = nodeChangesOfInterest.edges[0].node;

    const revisionsInRange = await getRevisionsInRange(
        maxRevisionNumber,
        minRevisionNumber,
        nodeId,
        nodeName,
        knex,
        nodeToSqlNameMappings
    );

    console.log('5. GET LINK CHANGE VERSIONS IN RANGE OF INTEREST', {
        isUsingConnectionCursor,
        maxRevisionTimeInUnixSecs,
        minRevisionTimeInUnixSecs,
        nodeName,
        nodeId
    });
    const linkChanges = await getLinkChangesInRangeOfInterest(
        knex,
        nodeToSqlNameMappings,
        maxRevisionTimeInUnixSecs,
        minRevisionTimeInUnixSecs,
        nodeName,
        nodeId
    );

    console.log(linkChanges);

    console.log('6. CALCULATE NODE DIFFS');
    // Step 6. Calculate nodes by applying revision diffs to previous node snapshots
    const nodesInRange = calculateNodesInRangeOfInterest(revisionsInRange, extractors);
    // const latestCalculatedNode = nodesInRange[nodesInRange.length - 1];

    console.log('7. BUILD VERSIONED EDGES');
    // Step 7. Build the versioned edges using the full nodes and the desired revisions
    const newEdges = calculateEdgesInRangeOfInterest(nodeChangesOfInterest, nodesInRange);

    const mergedEdges = mergeNodeEdgesWithEdgesInRangeOfInterest(linkChanges, newEdges);
    console.log('MERGED EDGESSSSSSS', mergedEdges);
    console.log('8. BUILD CONNECTION');
    // Step 8. Build the connection
    return {pageInfo: nodeChangesOfInterest.pageInfo, edges: mergedEdges};
};

export interface INodesOfInterest<ResolverT extends (...args: any[]) => any> {
    [revisionId: string]: UnPromisify<ReturnType<ResolverT>>;
}

const mergeNodeEdgesWithEdgesInRangeOfInterest = <ResolverT extends (...args: any[]) => any>(
    nodeEdgesOfVersions: ILinkChange[],
    edgesInRangeOfInterest: Array<
        Pick<
            Unpacked<IVersionConnection<UnPromisify<ReturnType<ResolverT>>>['edges']>,
            'cursor' | 'nodeChange' | 'node'
        >
    >
) => {
    // tslint:disable-next-line
    const joinedEdges = [...nodeEdgesOfVersions, ...edgesInRangeOfInterest].sort((edgeA, edgeB) => {
        const revisionTimeA = isRevisionEdge(edgeA)
            ? edgeA.revisionTime
            : edgeA.nodeChange && edgeA.nodeChange.revisionTime;
        const revisionTimeB = isRevisionEdge(edgeB)
            ? edgeB.revisionTime
            : edgeB.nodeChange && edgeB.nodeChange.revisionTime;

        if (!revisionTimeA || !revisionTimeB) {
            throw new Error('Missing revision time for revision');
        }
        return revisionTimeA > revisionTimeB ? 0 : -1;
    });

    // return joinedEdges;
    const newVersions = joinedEdges
        .reduce(
            (allEdges, edge, index) => {
                if (isRevisionEdge(edge) && index === 0) {
                    throw new Error(
                        'The first edge should be a revision not a record of edge creation'
                    );
                }
                if (isRevisionEdge(edge)) {
                    const lastEdge = allEdges[index - 1] || {};
                    const newEdge = {
                        ...lastEdge,
                        nodeChange: undefined,
                        linkChange: edge,
                        isLinkChange: true,
                        isNodeChange: false
                    };
                    allEdges.push(newEdge);
                } else {
                    allEdges.push({
                        ...edge,
                        linkChange: undefined,
                        isNodeChange: true,
                        isLinkChange: false
                    } as any);
                }
                return allEdges;
            },
            [] as IVersionConnection<UnPromisify<ReturnType<ResolverT>>>['edges']
        )
        .reverse();
    return newVersions;
};

const isRevisionEdge = (edge: ILinkChange | any): edge is ILinkChange => {
    return typeof edge.revisionTime === 'number';
};

const calculateEdgesInRangeOfInterest = <ResolverT extends (...args: any[]) => any>(
    revisionsOfInterest: IQueryResult<IRevisionQueryResult<number>>,
    nodesInRange: INodesOfInterest<ResolverT>
) => {
    return revisionsOfInterest.edges.map(edge => {
        const {
            revisionData,
            userId,
            nodeName: nn,
            nodeSchemaVersion,
            resolverOperation,
            revisionTime,
            revisionId,
            userRoles
        } = edge.node;
        const nodeChange = {
            revisionData,
            userId,
            nodeName: nn,
            nodeSchemaVersion,
            resolverOperation,
            revisionTime,
            revisionId,
            userRoles
        };
        const calculatedNode = nodesInRange[edge.node.revisionId];
        return {...edge, node: calculatedNode, nodeChange};
    });
};

const calculateNodesInRangeOfInterest = <ResolverT extends (...args: any[]) => any>(
    revisionsInRange: INodeBuilderRevisionInfo[],
    extractors: IVersionConnectionExtractors<ResolverT>
) => {
    return revisionsInRange.reduce(
        (nodes, revision, index) => {
            console.log('-----------------------------');
            const {revisionId, snapshotData, revisionData} = revision;
            if (index === 0 || snapshotData) {
                console.log('Using snapshot for', revisionId);
                nodes[revisionId] =
                    typeof snapshotData === 'string' ? JSON.parse(snapshotData) : snapshotData;
            } else {
                console.log('Calculating node for', revisionId);

                const previousRevision = revisionsInRange[index - 1];
                const calculatedNode = extractors.nodeBuilder(
                    nodes[previousRevision.revisionId],
                    revision
                );
                console.log('Calculated node', calculatedNode);
                console.log('Calculated diff', revisionData);

                nodes[revisionId] = calculatedNode;
            }
            return nodes;
        },
        {} as INodesOfInterest<ResolverT>
    );
};

/**
 * Gets the closest revision with a snapshot to the oldest revision of interest
 * This will be the initial snapshot that full nodes are calculated off of
 */
const getLinkChangesInRangeOfInterest = async (
    knex: Knex,
    nodeToSqlNameMappings: INamesForTablesAndColumns,
    maxRevisionTimeInUnixSecs: number,
    minRevisionTimeInUnixSecs: number,
    nodeName: string,
    nodeId: number | string
): Promise<ILinkChange[]> => {
    const result = (await knex
        .queryBuilder()
        .from(nodeToSqlNameMappings.tableNames.revisionEdge)
        .where(
            `${nodeToSqlNameMappings.tableNames.revisionEdge}.${nodeToSqlNameMappings.columnNames.revisionEdgeTime}`,
            '>=',
            unixSecondsToSqlTimestamp(minRevisionTimeInUnixSecs)
        )
        .where(
            `${nodeToSqlNameMappings.tableNames.revisionEdge}.${nodeToSqlNameMappings.columnNames.revisionEdgeTime}`,
            '<=',
            unixSecondsToSqlTimestamp(maxRevisionTimeInUnixSecs)
        )
        .andWhere({
            [`${nodeToSqlNameMappings.tableNames.revisionEdge}.${nodeToSqlNameMappings.columnNames.edgeNodeIdA}`]: nodeId, // tslint:disable-line
            [`${nodeToSqlNameMappings.tableNames.revisionEdge}.${nodeToSqlNameMappings.columnNames.edgeNodeNameA}`]: nodeName // tslint:disable-line
        })
        .select(
            `${nodeToSqlNameMappings.tableNames.revisionEdge}.${nodeToSqlNameMappings.columnNames.edgeNodeIdB} as edgeNodeId`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revisionEdge}.${nodeToSqlNameMappings.columnNames.edgeNodeNameB} as edgeNodeName`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revisionEdge}.${nodeToSqlNameMappings.columnNames.resolverOperation} as resolverOperation`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revisionEdge}.${nodeToSqlNameMappings.columnNames.revisionEdgeTime} as revisionTime` // tslint:disable-line
        )
        .orderBy(
            `${nodeToSqlNameMappings.tableNames.revisionEdge}.${nodeToSqlNameMappings.columnNames.revisionEdgeTime}`,
            'desc'
        )) as Array<{
        edgeNodeId: number;
        edgeNodeName: string;
        resolverOperation: string;
        revisionTime: string;
    }>;

    return result.map(n => castNodeWithRevisionTimeInDateTimeToUnixSecs(n));
};

/**
 * Gets the closest revision with a snapshot to the oldest revision of interest
 * This will be the initial snapshot that full nodes are calculated off of
 */
const getMinRevisionNumberWithSnapshot = async (
    revisionsOfInterest: IQueryResult<IRevisionQueryResult<number>>,
    knex: Knex,
    nodeToSqlNameMappings: INamesForTablesAndColumns
) => {
    if (revisionsOfInterest.edges.length === 0) {
        return undefined;
    }
    const firstRevisionInRange = revisionsOfInterest.edges[revisionsOfInterest.edges.length - 1];

    const hasSnapshotData = !!firstRevisionInRange.node.snapshotData;
    if (hasSnapshotData) {
        const {revisionId, revisionTime} = firstRevisionInRange.node;
        return {revisionId, revisionTime};
    }

    const {nodeId, revisionId: lastRevisionId} = firstRevisionInRange.node;
    const result = (await knex
        .queryBuilder()
        .from(nodeToSqlNameMappings.tableNames.revision)
        .leftJoin(
            nodeToSqlNameMappings.tableNames.revisionNodeSnapshot,
            `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.tableNames.revision}_${nodeToSqlNameMappings.columnNames.revisionId}`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`
        )
        .where({
            [`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeId}`]: nodeId
        })
        .whereNotNull(
            `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.columnNames.snapshotId}` // tslint:disable-line
        )
        .andWhere(
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
            '<',
            `${lastRevisionId} `
        )
        .select(
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId} as revisionId`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionTime} as revisionTime` // tslint:disable-line
        )
        .orderBy(
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
            'desc'
        )
        .first()) as {revisionId: number; revisionTime: string};

    console.log('resulttttt', result);
    return castNodeWithRevisionTimeInDateTimeToUnixSecs(result);
};

const getRevisionsInRange = async (
    maxRevisionNumber: number,
    minRevisionNumber: number,
    nodeId: string | number,
    nodeName: string,
    knex: Knex,
    nodeToSqlNameMappings: INamesForTablesAndColumns
) => {
    const query = (await knex
        .queryBuilder()
        .table(nodeToSqlNameMappings.tableNames.revision)
        .leftJoin(
            nodeToSqlNameMappings.tableNames.revisionNodeSnapshot,
            `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.tableNames.revision}_${nodeToSqlNameMappings.columnNames.revisionId}`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`
        )
        .where({
            [`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeId}`]: nodeId, // tslint:disable-line
            [`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeName}`]: nodeName // tslint:disable-line
        })
        .andWhere(
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
            '<=',
            `${maxRevisionNumber} `
        )
        .andWhere(
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
            '>=',
            `${minRevisionNumber} `
        )
        .select(
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionData} as revisionData`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionTime} as revisionTime`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeSchemaVersion} as nodeSchemaVersion`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeName} as nodeName`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeId} as nodeId`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.resolverOperation} as resolverOperation`, // tslint:disable-line

            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId} as revisionId`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.columnNames.snapshotData} as snapshotData` // tslint:disable-line
        )
        .orderBy(
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
            'asc'
        )) as INodeBuilderRevisionInfo[];

    return query;
};

const castUnixToDateTime = (filter: IFilter) => {
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    if (filter.field === 'revisionTime') {
        const date = parseInt(filter.value, 10);
        const value = unixSecondsToSqlTimestamp(date);
        console.log(`Changing revision time from ${filter.value}, to: ${value}`);
        return {
            ...filter,
            value
        };
    }
    return filter;
};

const castNodeWithRevisionTimeInDateTimeToUnixSecs = <T extends {revisionTime: string}>(
    node: T
): T & {revisionTime: number} => {
    const {revisionTime} = node;
    const newRevisionTime = castDateToUTCSeconds(revisionTime);
    console.log('~~~~~~~~~~~', `from: ${revisionTime}`, 'to :', newRevisionTime);
    return {
        ...node,
        revisionTime: newRevisionTime
    };
};

const getNodeChangesOfInterest = async <ResolverT extends (...args: any[]) => any>(
    resolverArgs: Parameters<ResolverT>,
    knex: Knex,
    nodeToSqlNameMappings: INamesForTablesAndColumns,
    extractors: IVersionConnectionExtractors<ResolverT>
): Promise<IQueryResult<IRevisionQueryResult<number>>> => {
    const attributeMap = {
        ...nodeToSqlNameMappings.columnNames,
        id: `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
        revisionId: `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
        revisionTime: `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionTime}`,
        userRoles: `${nodeToSqlNameMappings.tableNames.revisionRole}.${nodeToSqlNameMappings.columnNames.roleName}`
    };

    // force orderDir to be 'desc' b/c last is most recent in versions
    // const newInputArgs = {...inputArgs, orderDir: 'desc'};
    const nodeConnection = new ConnectionManager<IRevisionQueryResult<number>>(
        resolverArgs[1],
        attributeMap,
        {
            builderOptions: {
                filterTransformer: castUnixToDateTime
            },
            resultOptions: {
                nodeTransformer: castNodeWithRevisionTimeInDateTimeToUnixSecs
            }
        }
    );

    const {nodeId, nodeName} = extractors;
    // (
    //     resolverArgs[0],
    //     resolverArgs[1],
    //     resolverArgs[2],
    //     resolverArgs[3]
    // );
    // const nodeName = extractors.nodeName(
    //     resolverArgs[0],
    //     resolverArgs[1],
    //     resolverArgs[2],
    //     resolverArgs[3]
    // );

    const query = knex
        .queryBuilder()
        .from(function() {
            // const {roleName, snapshot: unusedSnapshot, ...attributes} = attributeMap;
            const queryBuilder = this.table(nodeToSqlNameMappings.tableNames.revision)
                .leftJoin(
                    nodeToSqlNameMappings.tableNames.revisionNodeSnapshot,
                    `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.tableNames.revision}_${nodeToSqlNameMappings.columnNames.revisionId}`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`
                )
                .leftJoin(
                    nodeToSqlNameMappings.tableNames.revisionUserRole,
                    `${nodeToSqlNameMappings.tableNames.revisionUserRole}.${nodeToSqlNameMappings.tableNames.revision}_${nodeToSqlNameMappings.columnNames.revisionId}`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`
                )
                .leftJoin(
                    nodeToSqlNameMappings.tableNames.revisionRole,
                    `${nodeToSqlNameMappings.tableNames.revisionUserRole}.${nodeToSqlNameMappings.tableNames.revisionRole}_${nodeToSqlNameMappings.columnNames.roleId}`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revisionRole}.${nodeToSqlNameMappings.columnNames.roleId}`
                )
                .where({
                    [`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeId}`]: nodeId, // tslint:disable-line
                    [`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeName}`]: nodeName // tslint:disable-line
                })
                .select(
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId} as revisionId`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionTime} as revisionTime`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionData} as revisionData`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeName} as nodeName`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeSchemaVersion} as nodeSchemaVersion`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeId} as nodeId`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.resolverOperation} as resolverOperation`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.userId} as userId`, // tslint:disable-line

                    `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.columnNames.snapshotData} as snapshotData`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.columnNames.snapshotTime} as snapshotTime` // tslint:disable-line
                )
                .orderBy(
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
                    'desc'
                );

            nodeConnection.createQuery(queryBuilder).as('main');
            console.log('QUERY', queryBuilder.toSQL());
        })
        .leftJoin(
            nodeToSqlNameMappings.tableNames.revisionUserRole,
            `${nodeToSqlNameMappings.tableNames.revisionUserRole}.${nodeToSqlNameMappings.tableNames.revision}_${nodeToSqlNameMappings.columnNames.revisionId}`, // tslint:disable-line
            `main.revisionId`
        )
        .leftJoin(
            nodeToSqlNameMappings.tableNames.revisionRole,
            `${nodeToSqlNameMappings.tableNames.revisionUserRole}.${nodeToSqlNameMappings.tableNames.revisionRole}_${nodeToSqlNameMappings.columnNames.roleId}`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revisionRole}.${nodeToSqlNameMappings.columnNames.roleId}`
        )
        .select(
            'revisionId', // tslint:disable-line
            'revisionTime', // tslint:disable-line
            'revisionData', // tslint:disable-line
            'nodeName', // tslint:disable-line
            'nodeSchemaVersion', // tslint:disable-line
            'nodeId', // tslint:disable-line
            'resolverOperation', // tslint:disable-line
            'userId', // tslint:disable-line
            'snapshotData', // tslint:disable-line
            'snapshotTime', // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revisionRole}.${nodeToSqlNameMappings.columnNames.roleName} as roleName` // tslint:disable-line
        );

    const nodeResult = await query;
    const uniqueVersions = aggregateVersionsById(nodeResult);

    nodeConnection.addResult(uniqueVersions);
    const {pageInfo, edges} = nodeConnection;
    return {pageInfo, edges};
};

/**
 * B/c user roles are 1:many with a revision we have duplicates of revisions
 * for each user role. Thus, we need to combine user roles together into an array for
 * each duplicate of a revision.
 */
const aggregateVersionsById = (
    nodeVersions: Array<{revisionId: string; roleName: string; revisionData: object}>
) => {
    // extract all the user roles for the version
    const rolesByRevisionId = nodeVersions.reduce(
        (rolesObj, {revisionId, roleName}) => {
            const roleNames = rolesObj[revisionId] || [];

            rolesObj[revisionId] = roleNames.includes(roleName)
                ? roleNames
                : [...roleNames, roleName];
            return rolesObj;
        },
        {} as {[revisionId: string]: string[]}
    );

    // map over the versions
    // - aggregate by version id
    // - serialize revision data to json if its not already
    // - add user roles
    const versions = nodeVersions.reduce(
        (uniqueVersions, version) => {
            if (uniqueVersions[version.revisionId]) {
                return uniqueVersions;
            }
            uniqueVersions[version.revisionId] = {
                ...version,
                userRoles: rolesByRevisionId[version.revisionId],
                revisionData:
                    typeof version.revisionData === 'string'
                        ? version.revisionData
                        : JSON.stringify(version.revisionData)
            };
            return uniqueVersions;
        },
        {} as {
            [revisionId: string]: {revisionId: string; userRoles: string[]; revisionData: string};
        }
    );

    // make sure versions are returned in the same order as they came in
    return [...new Set(nodeVersions.map(({revisionId}) => revisionId))].map(id => versions[id]);
};

const castDateToUTCSeconds = (date: string | Date): number | null => {
    return isDate(date) ? DateTime.fromJSDate(date, {zone: 'local'}).toSeconds() : null;
};

const isDate = (date?: Date | string): date is Date => {
    return date instanceof Date;
};

const unixSecondsToSqlTimestamp = (unixSeconds: number) => {
    return DateTime.fromSeconds(unixSeconds)
        .toUTC()
        .toSQL({includeOffset: true, includeZone: true});
};
