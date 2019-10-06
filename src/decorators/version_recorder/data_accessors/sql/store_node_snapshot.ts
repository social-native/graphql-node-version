import Knex from 'knex';
import {ISqlNodeSnapshotTable, ITableAndColumnNames, EventInfo} from 'types';
import {isEventNodeChangeWithSnapshotInfo} from 'type_guards';

/**
 * Write the node snapshot to the database
 */
export default async (
    transaction: Knex.Transaction,
    {table_names, node_snapshot}: ITableAndColumnNames,
    eventInfo: EventInfo,
    eventId: number
) => {
    if (isEventNodeChangeWithSnapshotInfo(eventInfo)) {
        await transaction
            .table<ISqlNodeSnapshotTable>(table_names.node_snapshot)
            .insert<ISqlNodeSnapshotTable>({
                [node_snapshot.snapshot]: JSON.stringify(eventInfo.snapshot),
                [node_snapshot.event_id]: eventId,
=
            });
    } else {
        throw new Error(
            'Called data accessor for storing event node change snapshots with a non node change snapshot event'
        );
    }
};
