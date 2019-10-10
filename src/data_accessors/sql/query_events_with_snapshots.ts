import Knex from 'knex';
import {
    ITableAndColumnNames,
    ISqlEventTable,
    ISqlNodeSnapshotTable,
    IVersionConnectionInfo,
    ILoggerConfig,
    INodeBuilderNodeChangeVersionInfo,
    IAllNodeBuilderVersionInfo,
    INodeBuilderNodeFragmentChangeVersionInfo
} from '../../types';
import {unixSecondsToSqlTimestamp, castDateToUTCSeconds} from '../../lib/time';
import {getLoggerFromConfig} from '../../logger';
import {EVENT_IMPLEMENTOR_TYPE_NAMES} from '../../enums';

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
    originalNodeInstance: Pick<IVersionConnectionInfo<ResolverT>, 'nodeId' | 'nodeName'>,
    loggerConfig?: ILoggerConfig
): Promise<Array<IAllNodeBuilderVersionInfo<number>>> => {
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
        // TODO fix error with this where statement
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
        .orderBy(`${table_names.node_snapshot}.${node_snapshot.snapshot}`, 'asc')
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
    const result = (await query) as Array<INodeBuilderNodeChangeVersionInfo<string>>;
    return result.map(r => {
        const rr = castNodeWithRevisionTimeInDateTimeToUnixSecs(r, logger);
        const isFragment =
            rr &&
            (rr.nodeId !== originalNodeInstance.nodeId ||
                rr.nodeName !== originalNodeInstance.nodeName);
        if (isFragment) {
            return {
                ...rr,
                nodeId: originalNodeInstance.nodeId,
                nodeName: originalNodeInstance.nodeName,
                type: EVENT_IMPLEMENTOR_TYPE_NAMES.NODE_FRAGMENT_CHANGE,
                childNodeName: rr.nodeName,
                childNodeId: rr.nodeId,
                childRevisionData: rr.revisionData,
                childNodeSchemaVersion: rr.nodeSchemaVersion
            } as INodeBuilderNodeFragmentChangeVersionInfo;
        } else {
            return rr;
        }
    });
};

const castNodeWithRevisionTimeInDateTimeToUnixSecs = (
    node: INodeBuilderNodeChangeVersionInfo<string>,
    logger?: ILoggerConfig['logger']
): INodeBuilderNodeChangeVersionInfo<number> => {
    const {createdAt} = node;
    const newRevisionTime = castDateToUTCSeconds(createdAt);
    logger && logger.debug('Casting dateTime -> unixSecs', createdAt, newRevisionTime); // tslint:disable-line
    return {
        ...node,
        createdAt: newRevisionTime
    };
};
