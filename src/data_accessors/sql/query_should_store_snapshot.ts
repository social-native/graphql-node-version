import Knex from 'knex';
import {
    ITableAndColumnNames,
    ISqlEventTable,
    ISqlNodeSnapshotTable,
    IEventNodeChangeInfo
} from '../../types';
/**
 * Fetch the number of full node snapshots for the node id and node schema version
 * If a snapshot exists within the expected snapshot frequency, then we don't need to take another snapshot
 */
export default (
    transaction: Knex.Transaction,
    {table_names, event, node_snapshot}: ITableAndColumnNames
) => async (eventInfo: IEventNodeChangeInfo): Promise<boolean> => {
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

    const snapshots = (await sql) as Array<{
        event_creation?: string;
        snapshot_creation?: string;
    }>;
    console.log('FOUND SNAPSHOTS', snapshots);
    const shouldStoreSnapshot = !snapshots.find(data => data.snapshot_creation);

    console.log('SHOULD STORE SNAPSHOT', shouldStoreSnapshot);
    return shouldStoreSnapshot;
};
