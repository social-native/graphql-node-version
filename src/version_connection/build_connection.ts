import {isGqlNodeChangeNode} from 'type_guards';
import {EVENT_IMPLEMENTOR_TYPE_NAMES} from 'enums';
import {getLoggerFromConfig} from 'logger';
import {ILoggerConfig, UnPromisify, NodeInConnection, IVersionConnection} from 'types';
import {IQueryResult} from '@social-native/snpkg-snapi-connections';

export default <ResolverT extends (...args: [any, any, any, any]) => IVersionConnection<any>>(
    versionNodeConnection: IQueryResult<NodeInConnection & {snapshot?: string}>,
    nodesOfConnectionByEventId: {[eventId: string]: UnPromisify<ReturnType<ResolverT>>},
    originNodeInstance: {nodeName: string; nodeId: string | number},
    loggerConfig?: ILoggerConfig
) => {
    const parentLogger = getLoggerFromConfig(loggerConfig);
    const logger = parentLogger.child({
        step: 'Building connection using connection edges and full nodes for each edge'
    });

    const newEdges = versionNodeConnection.edges.map(n => {
        const isFragment =
            n.node &&
            (n.node.nodeId !== originNodeInstance.nodeId ||
                n.node.nodeName !== originNodeInstance.nodeName);
        let version: typeof n.node;

        if (isFragment && isGqlNodeChangeNode(n.node)) {
            version = {
                ...n.node,
                nodeId: originNodeInstance.nodeId as string,
                nodeName: originNodeInstance.nodeName,
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
    const connection = {pageInfo: versionNodeConnection.pageInfo, edges: newEdges};
    logger.debug('Finished building connection', connection);

    return connection;
};
