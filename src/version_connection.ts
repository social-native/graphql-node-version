import {
    UnPromisify,
    IVersionConnectionExtractors,
    IGqlVersionNode,
    IConfig,
    INodeBuilderFragmentNodes
} from './types';
import {ConnectionManager} from '@social-native/snpkg-snapi-connections';
import queryVersionConnection from './data_accessors/sql/query_version_connection';
import queryNodeInstancesInConnection from './data_accessors/sql/query_node_instances_in_connection';
import queryTimeRangeOfVersionConnection from './data_accessors/sql/query_time_range_of_version_connection';
import queryEventsWithSnapshots from './data_accessors/sql/query_events_with_snapshots';

import {setNames} from 'sql_names';
import {getLoggerFromConfig} from 'logger';
import {EVENT_IMPLEMENTOR_TYPE_NAMES} from 'enums';
import {
    isGqlNodeChangeNode,
    isNodeBuilderNodeVersionInfoWithSnapshot,
    isNodeBuilderNodeFragmentChangeVersionInfo,
    isNodeBuilderNodeChangeVersionInfo,
    shouldSkipNodeBuilderBecauseHasLinkChangeVersionInfo
} from 'type_guards';

/**
 * Logic:
 * 1. Get all revisions in range of connection
 * 2. Calculate full nodes for all revisions in range
 * 3. Get revisions in connection (filters may apply etc)
 */
export default (config?: IConfig) => {
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
        const {
            fullNodes: nodesOfConnectionByEventId
        } = minSetOfEventsInConnectionThatStartWithASnapshot.reverse().reduce(
            (acc, event, index) => {
                // tslint:disable-next-line
                logger.debug('Building node for type: ', event.type);

                if (index === 0 && !isNodeBuilderNodeVersionInfoWithSnapshot(event)) {
                    logger.error('Missing initial snapshot for connection', event);
                    throw new Error('Missing initial snapshot');
                } else if (isNodeBuilderNodeVersionInfoWithSnapshot(event)) {
                    const nodeSnapshot = JSON.parse(event.snapshot);

                    if (isNodeBuilderNodeFragmentChangeVersionInfo(event)) {
                        const currentFragmentNodes = acc.fragmentNodes;
                        const childNodeByIds = currentFragmentNodes[event.childNodeName] || {};
                        childNodeByIds[event.childNodeId] = nodeSnapshot;

                        acc.fragmentNodes = {
                            ...acc.fragmentNodes,
                            [event.childNodeName]: childNodeByIds
                        };

                        const calculatedNode = extractors.nodeBuilder(
                            acc.lastNode,
                            event,
                            acc.fragmentNodes,
                            logger
                        );
                        acc.fullNodes[event.id] = calculatedNode;
                        acc.lastNode = calculatedNode;
                    } else if (isNodeBuilderNodeChangeVersionInfo(event)) {
                        acc.fullNodes[event.id] = nodeSnapshot;
                        acc.lastNode = nodeSnapshot;
                    } else {
                        throw new Error('Undefined node event with snapshot');
                    }
                } else {
                    if (isNodeBuilderNodeChangeVersionInfo(event)) {
                        const calculatedNode = extractors.nodeBuilder(
                            acc.lastNode,
                            event,
                            undefined,
                            logger
                        );
                        acc.fullNodes[event.id] = calculatedNode;
                        acc.lastNode = calculatedNode;
                    } else if (shouldSkipNodeBuilderBecauseHasLinkChangeVersionInfo(event)) {
                        acc.fullNodes[event.id] = acc.lastNode;
                    } else {
                        throw new Error('Undefined node event without snapshot');
                    }
                }

                return acc;
            },
            {fullNodes: {}, fragmentNodes: {}} as {
                fragmentNodes: INodeBuilderFragmentNodes;
                lastNode: UnPromisify<ReturnType<ResolverT>>;
                fullNodes: {[eventId: string]: UnPromisify<ReturnType<ResolverT>>};
            }
        );

        // Step 8. Build the connection
        logger.debug('Building final version connection');
        const newEdges = versionNodeConnection.edges.map(n => {
            const isFragment = n.node && (n.node.nodeId !== nodeId || n.node.nodeName !== nodeName);
            let version: typeof n.node;

            if (isFragment && isGqlNodeChangeNode(n.node)) {
                version = {
                    ...n.node,
                    nodeId: nodeId as string,
                    nodeName,
                    type: EVENT_IMPLEMENTOR_TYPE_NAMES.NODE_FRAGMENT_CHANGE,
                    childNodeName: n.node.nodeName,
                    childNodeId: n.node.nodeId,
                    childRevisionData: n.node.revisionData,
                    childNodeSchemaVersion: n.node.nodeSchemaVersion
                };
            } else {
                version = n.node;
            }
            return {
                cursor: n.cursor,
                node: nodesOfConnectionByEventId[n.node.id],
                version
            };
        });
        return {pageInfo: versionNodeConnection.pageInfo, edges: newEdges};
    };
};
