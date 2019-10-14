import {UnPromisify, IVersionConnectionExtractors, IGqlVersionNode, IConfig} from '../types';
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
 * 1. Get all revisions in range of connection
 * 2. Calculate full nodes for all revisions in range
 * 3. Get revisions in connection (filters may apply etc)
 */
export default (config?: IConfig) => {
    const tableAndColumnNames = generateTableAndColumnNames(config ? config.names : undefined);
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
        const minSetOfEventsInConnectionThatStartWithASnapshot = await queryEventsWithSnapshots(
            knex,
            tableAndColumnNames,
            timeRangeOfVersionConnection,
            nodeInstancesInConnection,
            {nodeId, nodeName},
            {logger}
        );
        logger.debug(
            'Number of node builder versions found',
            minSetOfEventsInConnectionThatStartWithASnapshot.length
        );
        logger.debug('Nodes for node builder:', minSetOfEventsInConnectionThatStartWithASnapshot);

        logger.debug('Building nodes for connection....');
        const nodesOfConnectionByEventId = buildConnectionNodesAndSortByEventId(
            minSetOfEventsInConnectionThatStartWithASnapshot,
            extractors,
            {logger}
        );
        // Step 8. Build the connection
        logger.debug('Building final version connection');
        return buildConnection(
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
