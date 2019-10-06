import Knex from 'knex';
import {
    ITableAndColumnNames,
    ISqlEventTable,
    ISqlNodeSnapshotTable,
    AllEventNodeChangeInfo
} from 'types';
/**
 * Fetch the number of full node snapshots for the node id and node schema version
 * If a snapshot exists within the expected snapshot frequency, then we don't need to take another snapshot
 */
export default async (
    transaction: Knex.Transaction,
    {table_names, event, node_snapshot}: ITableAndColumnNames,
    eventInfo: AllEventNodeChangeInfo
): Promise<boolean> => {
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
            `${table_names.event}.${event.created_at} as event_creation`,
            `${table_names.node_snapshot}.${node_snapshot.id} as snapshot_creation`
        );

    const snapshots = (await sql) as Array<{
        event_creation?: string;
        snapshot_creation?: string;
    }>;
    const snapshotWithinFrequencyRange = !!snapshots.find(data => data.snapshot_creation);

    return !snapshotWithinFrequencyRange;
};
