import {DateTime} from 'luxon';

import Knex from 'knex';
import {ITableAndColumnNames, IVersionConnectionInfo, NodeInConnection} from '../../types';
import {castDateToUTCSeconds} from 'lib/time';
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
    >
): Promise<{oldestCreatedAt: number; youngestCreatedAt: number}> => {
    // Get all revisions in range from the newest revision of interest to the
    //   oldest revision with a snapshot
    const isUsingConnectionCursor = !!(
        resolverArgs[1] &&
        (resolverArgs[1].before || resolverArgs[1].after)
    );
    const {createdAt} = nodesInVersionConnection[0];
    const youngestCreatedAt = isUsingConnectionCursor
        ? createdAt
        : Math.ceil(DateTime.utc().toSeconds());

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
        ? oldestNodesWithPossibilityOfSnapshots.filter(node => node && node.snapshot !== undefined)
        : []) as NodeInConnection[] | undefined;

    if (oldestNodes === undefined || oldestNodes.length === 0) {
        return {
            oldestCreatedAt: nodesInVersionConnectionOrderedOldestToYoungest[0].createdAt,
            youngestCreatedAt
        };
    }
    // Determine the oldest version with a full node snapshot
    const oldestVersion = await getMinCreatedAtOfVersionWithSnapshot(
        knex,
        tableAndColumnNames,
        oldestNodes
    );

    if (oldestVersion === undefined) {
        throw new Error('Missing oldest version');
    }

    const {createdAt: oldestCreatedAt} = oldestVersion;

    return {oldestCreatedAt, youngestCreatedAt};
};

/**
 * Gets the closest revision with a snapshot to the oldest revision of interest
 * This will be the initial snapshot that full nodes are calculated off of
 */
const getMinCreatedAtOfVersionWithSnapshot = async (
    knex: Knex,
    {table_names, event, node_snapshot}: ITableAndColumnNames,
    oldestNodes: NodeInConnection[]
): Promise<{createdAt: number}> => {
    const result = (await knex
        .queryBuilder()
        .from(table_names.event)
        .leftJoin(
            table_names.node_snapshot,
            `${table_names.node_snapshot}.${node_snapshot.event_id}`,
            `${table_names.event}.${event.id}`
        )
        .orWhere((k: Knex) => {
            oldestNodes.forEach(({nodeId, nodeName, createdAt}) => {
                k.andWhere({
                    [`${table_names.event}.${event.node_id}`]: nodeId,
                    [`${table_names.event}.${event.node_name}`]: nodeName
                });
                k.andWhere(`${table_names.event}.${event.created_at}`, '<', `${createdAt} `);
            });
        })
        .whereNotNull(`${table_names.node_snapshot}.${node_snapshot.snapshot}`)
        .select(`${table_names.event}.${event.created_at} as createdAt`)
        .orderBy(`${table_names.event}.${event.created_at}`, 'desc')
        .first()) as {createdAt: string};

    return castNodeWithRevisionTimeInDateTimeToUnixSecs(result);
};

const castNodeWithRevisionTimeInDateTimeToUnixSecs = <T extends {createdAt: string}>(
    node: T
): T & {createdAt: number} => {
    const {createdAt} = node;
    const newRevisionTime = castDateToUTCSeconds(createdAt);
    console.log('~~~~~~~~~~~', `from: ${createdAt}`, 'to :', newRevisionTime);
    return {
        ...node,
        createdAt: newRevisionTime
    };
};
