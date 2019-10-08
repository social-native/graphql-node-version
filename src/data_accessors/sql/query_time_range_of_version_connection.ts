import {DateTime} from 'luxon';

import Knex from 'knex';
import {
    ITableAndColumnNames,
    IVersionConnectionInfo,
    NodeInConnection,
    ILoggerConfig
} from '../../types';
import {castDateToUTCSeconds, unixSecondsToSqlTimestamp} from 'lib/time';
import {getLoggerFromConfig} from 'logger';
import Bluebird from 'bluebird';
/**
 * Fetch the number of full node snapshots for the node id and node schema version
 * If a snapshot exists within the expected snapshot frequency, then we don't need to take another snapshot
 */
export default async <ResolverT extends (...args: [any, any, any, any]) => any>(
    knex: Knex,
    tableAndColumnNames: ITableAndColumnNames,
    resolverArgs: Parameters<ResolverT>,
    nodesInVersionConnection: NodeInConnection[],
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
    const oldestNodesWithPossibilityOfSnapshots = allNodeInstancesInConnection.map(instanceNode => {
        return nodesInVersionConnectionOrderedOldestToYoungest.find(
            gqlNode =>
                gqlNode.nodeId === instanceNode.nodeId && gqlNode.nodeName === instanceNode.nodeName
        );
    });

    // Filter out any nodes that have snapshots
    const oldestNodes = (oldestNodesWithPossibilityOfSnapshots
        ? oldestNodesWithPossibilityOfSnapshots.filter(node => node && node.snapshot == null) // tslint:disable-line
        : []) as NodeInConnection[] | undefined;

    if (oldestNodesWithPossibilityOfSnapshots.length === 0) {
        // TODO handle this case
        logger.error('No oldest nodes found');
    }

    if (oldestNodes === undefined || oldestNodes.length === 0) {
        logger.debug('Oldest node has snapshot');
        return {
            oldestCreatedAt: nodesInVersionConnectionOrderedOldestToYoungest[0].createdAt,
            youngestCreatedAt
        };
    }
    // Determine the oldest version with a full node snapshot
    const oldestCreatedAt = await getMinCreatedAtOfVersionWithSnapshot(
        knex,
        tableAndColumnNames,
        oldestNodes,
        logger
    );

    if (oldestCreatedAt === undefined) {
        throw new Error('Missing oldest version');
    }

    return {oldestCreatedAt, youngestCreatedAt};
};

/**
 * Gets the closest revision with a snapshot to the oldest revision of interest
 * This will be the initial snapshot that full nodes are calculated off of
 */
const getMinCreatedAtOfVersionWithSnapshot = async (
    knex: Knex,
    {table_names, event, node_snapshot}: ITableAndColumnNames,
    oldestNodes: NodeInConnection[],
    logger?: ILoggerConfig['logger']
): Promise<number> => {
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
                '<',
                unixSecondsToSqlTimestamp(node.createdAt)
            )
            .whereNotNull(`${table_names.node_snapshot}.${node_snapshot.snapshot}`)
            .select(`${table_names.event}.${event.created_at} as createdAt`)
            .orderBy(`${table_names.event}.${event.created_at}`, 'desc')
            .first();

        logger && logger.debug('Raw SQL:', query.toQuery()); // tslint:disable-line
        const result = (await query) as {createdAt: string};
        return castNodeWithRevisionTimeInDateTimeToUnixSecs(result, logger);
    });

    if (!oldestCreatedAts || oldestCreatedAts.length === 0) {
        throw new Error('Couldnt find oldest nodes for establishing connection range');
    }
    return Math.max(...oldestCreatedAts.map(n => n.createdAt));
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
