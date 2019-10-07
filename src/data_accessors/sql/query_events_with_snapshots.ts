import Knex from 'knex';
import {
    ITableAndColumnNames,
    ISqlEventTable,
    ISqlNodeSnapshotTable,
    IVersionConnectionInfo
} from '../../types';
import {unixSecondsToSqlTimestamp} from 'lib/time';

export default async <ResolverT extends (...args: [any, any, any, any]) => any>(
    knex: Knex,
    {table_names, event, node_snapshot}: ITableAndColumnNames,
    timeRange: {oldestCreatedAt: number; youngestCreatedAt: number},
    allNodeInstancesInConnection: Array<
        Pick<IVersionConnectionInfo<ResolverT>, 'nodeId' | 'nodeName'>
    >
): Promise<Array<{createdAt: string; id: number; snapshot?: string}>> => {
    return (await knex
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
        .orWhere((k: Knex) => {
            allNodeInstancesInConnection.forEach(({nodeId, nodeName}) => {
                k.andWhere({
                    [`${table_names.event}.${event.node_id}`]: nodeId,
                    [`${table_names.event}.${event.node_name}`]: nodeName
                });
            });
        })
        .orderBy(`${table_names.event}.${event.created_at}`, 'desc')
        .select(
            `${table_names.event}.${event.id} as id`,
            `${table_names.event}.${event.created_at} as createdAt`,
            `${table_names.node_snapshot}.${node_snapshot.snapshot} as snapshot`
        )) as Array<{
        id: number;
        createdAt: string;
        snapshot?: string;
    }>;
};
