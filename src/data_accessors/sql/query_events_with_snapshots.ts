import Knex from 'knex';
import {
    ITableAndColumnNames,
    ISqlEventTable,
    ISqlNodeSnapshotTable,
    IVersionConnectionInfo,
    ILoggerConfig,
    INodeBuilderVersionInfo
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
    {
        table_names,
        event,
        node_snapshot,
        event_implementor_type,
        event_node_change
    }: ITableAndColumnNames,
    timeRange: {oldestCreatedAt: number; youngestCreatedAt: number},
    allNodeInstancesInConnection: Array<
        Pick<IVersionConnectionInfo<ResolverT>, 'nodeId' | 'nodeName'>
    >,
    loggerConfig?: ILoggerConfig
): Promise<Array<INodeBuilderVersionInfo<number>>> => {
    const parentLogger = getLoggerFromConfig(loggerConfig);
    const logger = parentLogger.child({query: 'Events with snapshots'});

    const query = knex
        .table<ISqlEventTable>(table_names.event)
        .leftJoin(
            table_names.event_implementor_type,
            `${table_names.event_implementor_type}.${event_implementor_type.id}`,
            `${table_names.event}.${event.implementor_type_id}`
        )
        .leftJoin(
            table_names.event_node_change,
            `${table_names.event_node_change}.${event_node_change.event_id}`,
            `${table_names.event}.${event.id}`
        )
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
            `${table_names.event_implementor_type}.${event_implementor_type.type} as type`,

            `${table_names.event}.${event.id} as id`,
            `${table_names.event}.${event.created_at} as createdAt`,
            `${table_names.event}.${event.node_name} as nodeName`,
            `${table_names.event}.${event.node_id} as nodeId`,
            `${table_names.event}.${event.user_id} as userId`,
            `${table_names.event}.${event.resolver_operation} as resolverOperation`,

            `${table_names.event_node_change}.${event_node_change.revision_data} as revisionData`,
            `${table_names.event_node_change}.${event_node_change.node_schema_version} as nodeSchemaVersion`,

            `${table_names.node_snapshot}.${node_snapshot.snapshot} as snapshot`
        );

    logger.debug('Raw SQL:', query.toQuery());
    const result = (await query) as Array<INodeBuilderVersionInfo<string>>;
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
