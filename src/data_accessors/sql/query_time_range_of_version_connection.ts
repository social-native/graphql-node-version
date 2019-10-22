import {DateTime} from 'luxon';
import Bluebird from 'bluebird';
import Knex from 'knex';

import {
    ITableAndColumnNames,
    IVersionConnectionInfo,
    NodeInConnection,
    ILoggerConfig,
    IVersionConnection,
    ExtractNodeFromVersionConnection,
    UnPromisify
} from '../../types';
import {castDateToUTCSeconds, unixSecondsToSqlTimestamp} from '../../lib/time';
import {getLoggerFromConfig} from '../../logger';
/**
 * Fetch the number of full node snapshots for the node id and node schema version
 * If a snapshot exists within the expected snapshot frequency, then we don't need to take another snapshot
 */
export default async <
    ResolverT extends (...args: [any, any, any, any]) => Promise<IVersionConnection<any>>,
    Snapshot = ExtractNodeFromVersionConnection<UnPromisify<ReturnType<ResolverT>>>
>(
    knex: Knex,
    tableAndColumnNames: ITableAndColumnNames,
    resolverArgs: Parameters<ResolverT>,
    nodesInVersionConnection: Array<NodeInConnection<Snapshot>>,
    allNodeInstancesInConnection: Array<
        Pick<IVersionConnectionInfo<ResolverT>, 'nodeId' | 'nodeName'>
    >,
    loggerConfig?: ILoggerConfig
): Promise<{oldestCreatedAt: number; youngestCreatedAt: number}> => {
    const parentLogger = getLoggerFromConfig(loggerConfig);
    const logger = parentLogger.child({query: 'Time range of version connection'});

    // Get all revisions in range from the newest revision of interest to the
    //   oldest revision with a snapshot
    const isUsingConnectionCursor = !!(
        resolverArgs[1] &&
        (resolverArgs[1].before || resolverArgs[1].after)
    );
    logger.debug('Is using connection cursor', isUsingConnectionCursor);

    const {createdAt} = nodesInVersionConnection[0];
    const youngestCreatedAt = isUsingConnectionCursor
        ? createdAt
        : Math.ceil(DateTime.utc().toSeconds());
    logger.debug('Youngest createdAt', youngestCreatedAt);

    // tslint:disable-next-line
    // Find oldest versions of each node instance in the connection
    const nodesInVersionConnectionOrderedOldestToYoungest = nodesInVersionConnection.reverse();
    const oldestNodeInVersionConnection = nodesInVersionConnection[0];
    const oldestNodesWithPossibilityOfSnapshots = allNodeInstancesInConnection.map(instanceNode => {
        return (
            nodesInVersionConnectionOrderedOldestToYoungest.find(
                gqlNode =>
                    gqlNode.nodeId === instanceNode.nodeId &&
                    gqlNode.nodeName === instanceNode.nodeName
            ) ||
            // combine instance node with node in connection which 'gives' the instance node a min `createdAt` field
            // so the search will start after this b/c the node is not in the connection but is required
            // to compute the present connection node's state
            ({
                ...oldestNodeInVersionConnection,
                ...instanceNode,
                snapshot: undefined
            } as typeof oldestNodeInVersionConnection)
        );
    });

    // Filter out any nodes that have snapshots
    const oldestNodes = (oldestNodesWithPossibilityOfSnapshots
        ? oldestNodesWithPossibilityOfSnapshots.filter(node => node && node.snapshot == null) // tslint:disable-line
        : []) as Array<NodeInConnection<Snapshot>> | undefined;

    logger.debug(
        'Number of node types that dont have snapshots in initial connection',
        oldestNodesWithPossibilityOfSnapshots.length
    );
    if (oldestNodesWithPossibilityOfSnapshots.length === 0) {
        // TODO handle this case
        logger.error('No oldest nodes found');
    }

    if (oldestNodes === undefined || oldestNodes.length === 0) {
        logger.debug('Oldest node has snapshot');
        return {
            oldestCreatedAt: oldestNodeInVersionConnection.createdAt,
            youngestCreatedAt
        };
    }
    // Determine the oldest version with a full node snapshot
    const oldestCreatedAt = await getMinCreatedAtOfVersionWithSnapshot<Snapshot>(
        knex,
        tableAndColumnNames,
        oldestNodes,
        logger
    );

    // tslint:disable-next-line
    if (oldestCreatedAt == null) {
        logger.debug('Missing oldest version');
        if (oldestNodeInVersionConnection.createdAt) {
            return {
                oldestCreatedAt: oldestNodeInVersionConnection.createdAt,
                youngestCreatedAt
            };
        } else {
            throw new Error(
                'No oldest node to use in time range of version connection snapshot events'
            );
        }
    }

    logger.debug('Found oldest snapshot in version connection');
    return {oldestCreatedAt, youngestCreatedAt};
};

/**
 * Gets the closest revision with a snapshot to the oldest revision of interest
 * This will be the initial snapshot that full nodes are calculated off of
 */
const getMinCreatedAtOfVersionWithSnapshot = async <Snapshot>(
    knex: Knex,
    {table_names, event, node_snapshot}: ITableAndColumnNames,
    oldestNodes: Array<NodeInConnection<Snapshot>>,
    logger?: ILoggerConfig['logger']
): Promise<number | undefined> => {
    logger && logger.debug('Querying oldest snapshots for nodes:', oldestNodes); // tslint:disable-line
    const oldestCreatedAts = await Bluebird.map(oldestNodes, async node => {
        const query = knex
            .queryBuilder()
            .from(table_names.event)
            .leftJoin(
                table_names.node_snapshot,
                `${table_names.node_snapshot}.${node_snapshot.event_id}`,
                `${table_names.event}.${event.id}`
            )
            .andWhere({
                [`${table_names.event}.${event.node_id}`]: node.nodeId,
                [`${table_names.event}.${event.node_name}`]: node.nodeName
            })
            .andWhere(
                `${table_names.event}.${event.created_at}`,
                '<=',
                unixSecondsToSqlTimestamp(node.createdAt)
            )
            .whereNotNull(`${table_names.node_snapshot}.${node_snapshot.snapshot}`)
            .select(`${table_names.event}.${event.created_at} as createdAt`)
            .orderBy(`${table_names.event}.${event.created_at}`, 'desc')
            .first();

        logger && logger.debug('Raw SQL:', logger.level === 'debug' && query.toQuery()); // tslint:disable-line
        const result = (await query) as {createdAt: string};
        return result ? castNodeWithRevisionTimeInDateTimeToUnixSecs(result, logger) : undefined;
    });

    if (!oldestCreatedAts || oldestCreatedAts.length === 0) {
        throw new Error('Couldnt find oldest nodes for establishing connection range');
    }
    const existingOldestCreatedAts = oldestCreatedAts.filter(n => n) as Array<{createdAt: number}>;
    return existingOldestCreatedAts.length > 0
        ? Math.min(...existingOldestCreatedAts.map(n => n.createdAt))
        : undefined;
};

const castNodeWithRevisionTimeInDateTimeToUnixSecs = <T extends {createdAt: string}>(
    node: T,
    logger?: ILoggerConfig['logger']
): T & {createdAt: number} => {
    const {createdAt} = node;
    const newRevisionTime = castDateToUTCSeconds(createdAt);
    logger && logger.debug('Casting dateTime -> unixSecs', createdAt, newRevisionTime); // tslint:disable-line
    return {
        ...node,
        createdAt: newRevisionTime
    };
};
