import {isGqlNodeChangeNode} from 'type_guards';
import {EVENT_IMPLEMENTOR_TYPE_NAMES} from 'enums';
import {getLoggerFromConfig} from 'logger';
import {
    ILoggerConfig,
    UnPromisify,
    NodeInConnection,
    IVersionConnection,
    ExtractNodeFromVersionConnection
} from 'types';
import {IQueryResult} from '@social-native/snpkg-snapi-connections';

export default <
    ResolverT extends (...args: [any, any, any, any]) => Promise<IVersionConnection<any>>,
    Snapshot = ExtractNodeFromVersionConnection<UnPromisify<ReturnType<ResolverT>>>
>(
    isUsingCursorConnection: boolean,
    currentVersionNode: Snapshot,
    versionNodeConnection: IQueryResult<
        NodeInConnection<Snapshot> & {
            snapshot?: Snapshot;
        }
    >,
    nodesOfConnectionByEventId: {
        [eventId: string]: Snapshot;
    },
    originNodeInstance: {nodeName: string; nodeId: string | number},
    loggerConfig?: ILoggerConfig
) => {
    const parentLogger = getLoggerFromConfig(loggerConfig);
    const logger = parentLogger.child({
        step: 'Building connection using connection edges and full nodes for each edge'
    });

    // tslint:disable-next-line
    const newEdges = versionNodeConnection.edges.map((n, index) => {
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
            node:
                // if this is the most recent node use the node that was fetched from the data store
                index === 0 && !isUsingCursorConnection
                    ? currentVersionNode
                    : nodesOfConnectionByEventId[n.node.id],
            version
        };
    });
    const connection = {pageInfo: versionNodeConnection.pageInfo, edges: newEdges};
    logger.debug('Finished building connection');

    return connection;
};
