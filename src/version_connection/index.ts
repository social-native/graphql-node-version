import {
    UnPromisify,
    IVersionConnectionExtractors,
    IGqlVersionNode,
    IConfig,
    IVersionConnection,
    ExtractNodeFromVersionConnection
} from '../types';
import {ConnectionManager} from '@social-native/snpkg-snapi-connections';

import queryVersionConnection from '../data_accessors/sql/query_version_connection';
import queryNodeInstancesInConnection from '../data_accessors/sql/query_node_instances_in_connection';
import queryTimeRangeOfVersionConnection from '../data_accessors/sql/query_time_range_of_version_connection';
import queryEventsWithSnapshots from '../data_accessors/sql/query_events_with_snapshots';
import {generateTableAndColumnNames} from '../sql_names';
import {getLoggerFromConfig} from '../logger';
import buildConnectionNodesAndSortByEventId from './build_nodes';
import buildConnection from './build_connection';

/**
 * Logic:
 * 1. Get current node
 * 2. Get all versions in connection
 * 3. For each node instance (nodeId and nodeName) in connection, find youngest snapshot older than connection
 * 4. Map version diff to snapshot or previous node state to calculate next node state
 * 5. Return connection
 */

export default (config?: IConfig) => {
    const tableAndColumnNames = generateTableAndColumnNames(config ? config.names : undefined);
    const parentLogger = getLoggerFromConfig(config);
    const logger = parentLogger.child({api: 'Version Connection'});

    return async <
        ResolverT extends (...args: any[]) => Promise<IVersionConnection<any>>,
        RevisionData = any,
        Node = ExtractNodeFromVersionConnection<UnPromisify<ReturnType<ResolverT>>>
    >(
        currentVersionNode: Node,
        resolverArgs: Parameters<ResolverT>,
        extractors: IVersionConnectionExtractors<ResolverT, RevisionData>
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
        const versionNodeConnection = await queryVersionConnection<ResolverT>(
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
        const allEventsInConnectionAndBeyondExtendToFirstSnapshot = await queryEventsWithSnapshots(
            knex,
            tableAndColumnNames,
            timeRangeOfVersionConnection,
            nodeInstancesInConnection,
            {nodeId, nodeName},
            {logger}
        );
        logger.debug(
            'Number of node builder versions found',
            allEventsInConnectionAndBeyondExtendToFirstSnapshot.length
        );
        logger.debug(
            'Nodes for node builder:',
            allEventsInConnectionAndBeyondExtendToFirstSnapshot
        );

        logger.debug('Building nodes for connection....');
        const nodesOfConnectionByEventId = buildConnectionNodesAndSortByEventId<
            ResolverT,
            RevisionData
        >(allEventsInConnectionAndBeyondExtendToFirstSnapshot, extractors, {logger});

        logger.debug('Building final version connection');
        return buildConnection<ResolverT>(
            versionNodeConnection,
            nodesOfConnectionByEventId,
            {
                nodeId,
                nodeName
            },
            {logger}
        );
    };
};
