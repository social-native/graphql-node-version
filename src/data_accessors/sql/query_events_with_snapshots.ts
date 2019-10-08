import Knex from 'knex';
import {
    ITableAndColumnNames,
    ISqlEventTable,
    ISqlNodeSnapshotTable,
    IVersionConnectionInfo,
    ILoggerConfig
} from '../../types';
import {unixSecondsToSqlTimestamp, castDateToUTCSeconds} from 'lib/time';
import {getLoggerFromConfig} from 'logger';

export interface IEventWithSnapshot {
    createdAt: number;
    id: number;
    nodeId: string;
    nodeName: string;
    snapshot?: string;
}
export default async <ResolverT extends (...args: [any, any, any, any]) => any>(
    knex: Knex,
    {table_names, event, node_snapshot}: ITableAndColumnNames,
    timeRange: {oldestCreatedAt: number; youngestCreatedAt: number},
    allNodeInstancesInConnection: Array<
        Pick<IVersionConnectionInfo<ResolverT>, 'nodeId' | 'nodeName'>
    >,
    loggerConfig?: ILoggerConfig
): Promise<IEventWithSnapshot[]> => {
    const parentLogger = getLoggerFromConfig(loggerConfig);
    const logger = parentLogger.child({query: 'Events with snapshots'});

    const query = knex
        .table<ISqlEventTable>(table_names.event)
        .leftJoin<ISqlNodeSnapshotTable>(
            table_names.node_snapshot,
            `${table_names.event}.${event.id}`,
            `${table_names.node_snapshot}.${node_snapshot.event_id}`
        )
        .where(
            `${table_names.event}.${event.created_at}`,
            '>=',
            unixSecondsToSqlTimestamp(timeRange.oldestCreatedAt)
        )
        .where(
            `${table_names.event}.${event.created_at}`,
            '<=',
            unixSecondsToSqlTimestamp(timeRange.youngestCreatedAt)
        )
        .andWhere((k: Knex) => {
            allNodeInstancesInConnection.forEach(({nodeId, nodeName}) => {
                k.orWhere({
                    [`${table_names.event}.${event.node_id}`]: nodeId,
                    [`${table_names.event}.${event.node_name}`]: nodeName
                });
            });
        })
        .orderBy(`${table_names.event}.${event.created_at}`, 'desc')
        .select(
            `${table_names.event}.${event.id} as id`,
            `${table_names.event}.${event.node_id} as nodeId`,
            `${table_names.event}.${event.node_id} as nodeName`,
            `${table_names.event}.${event.created_at} as createdAt`,
            `${table_names.node_snapshot}.${node_snapshot.snapshot} as snapshot`
        );

    logger.debug('Raw SQL:', query.toQuery());

    const result = (await query) as Array<{
        id: number;
        nodeId: string;
        nodeName: string;
        createdAt: string;
        snapshot?: string;
    }>;

    return result.map(r => castNodeWithRevisionTimeInDateTimeToUnixSecs(r, logger));
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
