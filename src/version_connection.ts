import {
    UnPromisify,
    IVersionConnectionExtractors,
    ITableAndColumnNames,
    IGqlVersionNode
} from './types';
import {ConnectionManager} from '@social-native/snpkg-snapi-connections';
import queryVersionConnection from './data_accessors/sql/query_version_connection';
import queryNodeInstancesInConnection from './data_accessors/sql/query_node_instances_in_connection';
import queryTimeRangeOfVersionConnection from './data_accessors/sql/query_time_range_of_version_connection';
import queryEventsWithSnapshots from './data_accessors/sql/query_events_with_snapshots';

import {setNames} from 'sql_names';

/**
 * Logic:
 * 1. Get all revisions in range of connection
 * 2. Calculate full nodes for all revisions in range
 * 3. Get revisions in connection (filters may apply etc)
 */
export default <ResolverT extends (...args: [any, any, any, any]) => any>(
    extractors: IVersionConnectionExtractors<ResolverT>,
    config?: {names: ITableAndColumnNames}
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
            return createVersionConnectionWithFullNodes<ResolverT>(
                latestNode,
                args as Parameters<ResolverT>,
                extractors,
                config
            );
        }) as ResolverT;

        return descriptor;
    };
};

export const createVersionConnectionWithFullNodes = async <
    ResolverT extends (...args: [any, any, any, any]) => any
>(
    currentVersionNode: UnPromisify<ReturnType<ResolverT>>,
    resolverArgs: Parameters<ResolverT>,
    extractors: IVersionConnectionExtractors<ResolverT>,
    config?: {names: ITableAndColumnNames}
) => {
    // tslint:disable-next-line
    console.log('CURRENT NODE', currentVersionNode);
    const {knex, nodeId, nodeName} = extractors;

    const tableAndColumnNames = setNames(config ? config.names : undefined);

    const nodeInstancesInConnection = await queryNodeInstancesInConnection(
        knex,
        tableAndColumnNames,
        {nodeId, nodeName}
    );

    const versionNodeConnection = await queryVersionConnection(
        resolverArgs[1],
        knex,
        tableAndColumnNames,
        nodeInstancesInConnection
    );

    console.log('2. CHECK IF THERE ARE NO NODE CHANGE REVISIONS');
    // Step 2. If there are no revisions in the connection, return with no edges
    if (versionNodeConnection.edges.length === 0) {
        const nodeConnection = new ConnectionManager<IGqlVersionNode>(resolverArgs[1], {});
        nodeConnection.addResult([{}]);
        const {edges, pageInfo} = nodeConnection;
        const firstEdge = edges[0];
        return {pageInfo, edges: [{...firstEdge, version: undefined, node: currentVersionNode}]};
    }

    const timeRangeOfVersionConnection = await queryTimeRangeOfVersionConnection(
        knex,
        tableAndColumnNames,
        resolverArgs,
        versionNodeConnection.edges.map(e => e.node),
        nodeInstancesInConnection
    );

    const eventsWithSnapshots = await queryEventsWithSnapshots(
        knex,
        tableAndColumnNames,
        timeRangeOfVersionConnection,
        nodeInstancesInConnection
    );

    console.log(eventsWithSnapshots);
    // TODO FINISH
    // const eventsWithFullNodes = eventsWithSnapshots.reverse().reduce(
    //     (acc, event) => {
    //         if (event.snapshot) {
    //             // const node = JSON.parse(event.snapshot) as UnPromisify<ReturnType<ResolverT>>;
    //             acc.mostRecentSnapshot[`${event.nodeId}-${event.nodeName}`] = event.snapshot;
    //         }
    //         const snapshot = acc.mostRecentSnapshot[`${event.nodeId}-${event.nodeName}`];
    //         if (snapshot) {
    //             const calculatedNode = extractors.nodeBuilder(
    //                 nodes[previousRevision.revisionId],
    //                 revision
    //             );
    //         }
    //         return acc;
    //     },
    //     {mostRecentSnapshot: {}, fullNodes: {}} as {
    //         mostRecentSnapshot: {[nodeIdAndNodeName: string]: string};
    //         lastVersion: {[nodeIdAndNodeName: string]: string};
    //         fullNodes: {[eventId: number]: object};
    //     }
    // );

    // Step 8. Build the connection
    return {pageInfo: versionNodeConnection.pageInfo, edges: versionNodeConnection.edges};
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
