import {
    UnPromisify,
    IVersionConnectionExtractors,
    IGqlVersionNode,
    IConfig,
    NodeInConnection
} from './types';
import {ConnectionManager} from '@social-native/snpkg-snapi-connections';
import queryVersionConnection from './data_accessors/sql/query_version_connection';
import queryNodeInstancesInConnection from './data_accessors/sql/query_node_instances_in_connection';
import queryTimeRangeOfVersionConnection from './data_accessors/sql/query_time_range_of_version_connection';
import queryEventsWithSnapshots from './data_accessors/sql/query_events_with_snapshots';

import {setNames} from 'sql_names';
import {getLoggerFromConfig} from 'logger';

/**
 * Logic:
 * 1. Get all revisions in range of connection
 * 2. Calculate full nodes for all revisions in range
 * 3. Get revisions in connection (filters may apply etc)
 */
export const createVersionConnectionWithFullNodes = (config?: IConfig) => {
    const tableAndColumnNames = setNames(config ? config.names : undefined);
    const parentLogger = getLoggerFromConfig(config);
    const logger = parentLogger.child({api: 'Version Connection'});

    return async <ResolverT extends (...args: [any, any, any, any]) => any>(
        currentVersionNode: UnPromisify<ReturnType<ResolverT>>,
        resolverArgs: Parameters<ResolverT>,
        extractors: IVersionConnectionExtractors<ResolverT>
    ) => {
        // tslint:disable-next-line
        logger.debug('Current node', currentVersionNode);
        const {knex, nodeId, nodeName} = extractors;

        logger.debug('Querying for node instances in connection');
        const nodeInstancesInConnection = await queryNodeInstancesInConnection(
            knex,
            tableAndColumnNames,
            {nodeId, nodeName},
            {logger}
        );
        logger.debug('Node instances in connection', nodeInstancesInConnection);

        logger.debug('Querying for version connection');
        const versionNodeConnection = await queryVersionConnection(
            resolverArgs[1],
            knex,
            tableAndColumnNames,
            nodeInstancesInConnection,
            {logger}
        );
        logger.debug('Number of edges in connection: ', versionNodeConnection.edges.length);

        if (versionNodeConnection.edges.length === 0) {
            logger.warn('No edges found for version connection. Returning an empty connection');

            const nodeConnection = new ConnectionManager<IGqlVersionNode>(resolverArgs[1], {});
            nodeConnection.addResult([{}]);
            const {edges, pageInfo} = nodeConnection;
            const firstEdge = edges[0];
            return {
                pageInfo,
                edges: [{...firstEdge, version: undefined, node: currentVersionNode}]
            };
        }

        logger.debug('Querying for time range of connection');
        const timeRangeOfVersionConnection = await queryTimeRangeOfVersionConnection(
            knex,
            tableAndColumnNames,
            resolverArgs,
            versionNodeConnection.edges.map(e => e.node),
            nodeInstancesInConnection,
            {logger}
        );
        logger.debug('Time range of version connection', timeRangeOfVersionConnection);

        logger.debug('Querying for snapshots in time range');
        const eventsWithSnapshots = await queryEventsWithSnapshots(
            knex,
            tableAndColumnNames,
            timeRangeOfVersionConnection,
            nodeInstancesInConnection,
            {logger}
        );

        logger.debug('Number of snapshots found', eventsWithSnapshots.length);
        logger.info('snapshots', eventsWithSnapshots);

        const versionsInConnectionById = versionNodeConnection.edges.reduce(
            (acc, {node}) => {
                acc[node.id] = node;
                return acc;
            },
            {} as {[eventId: string]: NodeInConnection & {snapshot?: string}}
        );

        logger.debug('Building nodes for connection....');
        const {fullNodes: fullNodesByEventId} = eventsWithSnapshots.reverse().reduce(
            (acc, event, index) => {
                if (index === 0 && !event.snapshot) {
                    logger.error('Missing initial snapshot for connection', event);
                    throw new Error('Missing initial snapshot for connection');
                } else if (index === 0 && event.snapshot) {
                    const lastNode = JSON.parse(event.snapshot);
                    acc.fullNodes[event.id] = lastNode;
                    acc.lastNode = lastNode;
                } else {
                    const calculatedNode = extractors.nodeBuilder(
                        acc.lastNode,
                        versionsInConnectionById[event.id] as any
                    );
                    acc.fullNodes[event.id] = calculatedNode;
                    acc.lastNode = calculatedNode;
                }

                return acc;
            },
            {fullNodes: {}} as {
                lastNode: UnPromisify<ReturnType<ResolverT>>;
                fullNodes: {[eventId: string]: UnPromisify<ReturnType<ResolverT>>};
            }
        );

        // Step 8. Build the connection
        logger.debug('Building final version connection');
        const newEdges = versionNodeConnection.edges.map(n => ({
            cursor: n.cursor,
            node: fullNodesByEventId[n.node.id],
            version: n.node
        }));
        return {pageInfo: versionNodeConnection.pageInfo, edges: newEdges};
    };
};

// export interface INodesOfInterest<ResolverT extends (...args: any[]) => any> {
//     [revisionId: string]: UnPromisify<ReturnType<ResolverT>>;
// }

// const mergeNodeEdgesWithEdgesInRangeOfInterest = <ResolverT extends (...args: any[]) => any>(
//     nodeEdgesOfVersions: ILinkChange[],
//     edgesInRangeOfInterest: Array<
//         Pick<
//             Unpacked<IVersionConnection<UnPromisify<ReturnType<ResolverT>>>['edges']>,
//             'cursor' | 'nodeChange' | 'node'
//         >
//     >
// ) => {
//     // tslint:disable-next-line
//     const joinedEdges = [...nodeEdgesOfVersions, ...edgesInRangeOfInterest].sort((edgeA, edgeB) => {
//         const revisionTimeA = isRevisionEdge(edgeA)
//             ? edgeA.revisionTime
//             : edgeA.nodeChange && edgeA.nodeChange.revisionTime;
//         const revisionTimeB = isRevisionEdge(edgeB)
//             ? edgeB.revisionTime
//             : edgeB.nodeChange && edgeB.nodeChange.revisionTime;

//         if (!revisionTimeA || !revisionTimeB) {
//             throw new Error('Missing revision time for revision');
//         }
//         return revisionTimeA > revisionTimeB ? 0 : -1;
//     });

//     // return joinedEdges;
//     const newVersions = joinedEdges
//         .reduce(
//             (allEdges, edge, index) => {
//                 if (isRevisionEdge(edge) && index === 0) {
//                     throw new Error(
//                         'The first edge should be a revision not a record of edge creation'
//                     );
//                 }
//                 if (isRevisionEdge(edge)) {
//                     const lastEdge = allEdges[index - 1] || {};
//                     const newEdge = {
//                         ...lastEdge,
//                         nodeChange: undefined,
//                         linkChange: edge,
//                         isLinkChange: true,
//                         isNodeChange: false
//                     };
//                     allEdges.push(newEdge);
//                 } else {
//                     allEdges.push({
//                         ...edge,
//                         linkChange: undefined,
//                         isNodeChange: true,
//                         isLinkChange: false
//                     } as any);
//                 }
//                 return allEdges;
//             },
//             [] as IVersionConnection<UnPromisify<ReturnType<ResolverT>>>['edges']
//         )
//         .reverse();
//     return newVersions;
// };

// const isRevisionEdge = (edge: ILinkChange | any): edge is ILinkChange => {
//     return typeof edge.revisionTime === 'number';
// };

// const calculateEdgesInRangeOfInterest = <ResolverT extends (...args: any[]) => any>(
//     revisionsOfInterest: IQueryResult<IRevisionQueryResult<number>>,
//     nodesInRange: INodesOfInterest<ResolverT>
// ) => {
//     return revisionsOfInterest.edges.map(edge => {
//         const {
//             revisionData,
//             userId,
//             nodeName: nn,
//             nodeSchemaVersion,
//             resolverOperation,
//             revisionTime,
//             revisionId,
//             userRoles
//         } = edge.node;
//         const nodeChange = {
//             revisionData,
//             userId,
//             nodeName: nn,
//             nodeSchemaVersion,
//             resolverOperation,
//             revisionTime,
//             revisionId,
//             userRoles
//         };
//         const calculatedNode = nodesInRange[edge.node.revisionId];
//         return {...edge, node: calculatedNode, nodeChange};
//     });
// };

// const calculateNodesInRangeOfInterest = <ResolverT extends (...args: any[]) => any>(
//     revisionsInRange: INodeBuilderRevisionInfo[],
//     extractors: IVersionConnectionExtractors<ResolverT>
// ) => {
//     return revisionsInRange.reduce(
//         (nodes, revision, index) => {
//             console.log('-----------------------------');
//             const {revisionId, snapshotData, revisionData} = revision;
//             if (index === 0 || snapshotData) {
//                 console.log('Using snapshot for', revisionId);
//                 nodes[revisionId] =
//                     typeof snapshotData === 'string' ? JSON.parse(snapshotData) : snapshotData;
//             } else {
//                 console.log('Calculating node for', revisionId);

//                 const previousRevision = revisionsInRange[index - 1];
//                 const calculatedNode = extractors.nodeBuilder(
//                     nodes[previousRevision.revisionId],
//                     revision
//                 );
//                 console.log('Calculated node', calculatedNode);
//                 console.log('Calculated diff', revisionData);

//                 nodes[revisionId] = calculatedNode;
//             }
//             return nodes;
//         },
//         {} as INodesOfInterest<ResolverT>
//     );
// };
