import Knex from 'knex';
import {
    ITableAndColumnNames,
    ISqlEventTable,
    ISqlNodeSnapshotTable,
    IEventNodeChangeInfo,
    ILoggerConfig
} from '../../types';
import {getLoggerFromConfig} from '../../logger';
/**
 * Fetch the number of full node snapshots for the node id and node schema version
 * If a snapshot exists within the expected snapshot frequency, then we don't need to take another snapshot
 */
export default (
    transaction: Knex.Transaction,
    {table_names, event, node_snapshot}: ITableAndColumnNames,
    loggerConfig?: ILoggerConfig
) => async (eventInfo: IEventNodeChangeInfo): Promise<boolean> => {
    const parentLogger = getLoggerFromConfig(loggerConfig);
    const logger = parentLogger.child({query: 'Should store snapshots'});

    const sql = transaction
        .table<ISqlEventTable>(table_names.event)
        .leftJoin<ISqlNodeSnapshotTable>(
            table_names.node_snapshot,
            `${table_names.event}.${event.id}`,
            `${table_names.node_snapshot}.${node_snapshot.event_id}`
        )
        .where({
            [`${table_names.event}.${event.node_name}`]: eventInfo.nodeName,
            [`${table_names.event}.${event.node_id}`]: eventInfo.nodeId,
            [`${table_names.node_snapshot}.${node_snapshot.node_schema_version}`]: eventInfo.nodeSchemaVersion
        })
        .orderBy(`${table_names.event}.${event.created_at}`, 'desc')
        .limit(eventInfo.snapshotFrequency)
        .select(
            // TODO remove `event_creation` its not used
            `${table_names.event}.${event.created_at} as event_creation`,
            `${table_names.node_snapshot}.${node_snapshot.id} as snapshot_creation`
        );

    logger.debug('Raw SQL:', sql.toQuery());
    const snapshots = (await sql) as Array<{
        event_creation?: string;
        snapshot_creation?: string;
    }>;
    const shouldStoreSnapshot = !snapshots.find(data => data.snapshot_creation);
    logger.debug('Should store snapshots:', shouldStoreSnapshot);

    return shouldStoreSnapshot;
};
