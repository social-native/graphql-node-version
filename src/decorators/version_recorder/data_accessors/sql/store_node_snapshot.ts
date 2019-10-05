import Knex from 'knex';
import {ISqlNodeSnapshotTable, ITableAndColumnNames, ISnapshotInfo} from 'types';

/**
 * Write the node snapshot to the database
 */
export default async (
    transaction: Knex.Transaction,
    {table_names, node_snapshot}: ITableAndColumnNames,
    snapshotInfo: ISnapshotInfo
) => {
    await transaction
        .table<ISqlNodeSnapshotTable>(table_names.node_snapshot)
        .insert<ISqlNodeSnapshotTable>({
            [node_snapshot.snapshot]: JSON.stringify(snapshotInfo.snapshot),
            [node_snapshot.created_at]: snapshotInfo.createdAt,
            [node_snapshot.node_schema_version]: snapshotInfo.nodeSchemaVersion,
            [node_snapshot.node_id]: snapshotInfo.nodeId,
            [node_snapshot.node_name]: snapshotInfo.nodeName
        });
};
