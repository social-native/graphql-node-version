import Knex from 'knex';
import {ITableAndColumnNames, ISqlEventNodeChangeTable, IEventNodeChangeInfo} from '../../types';
import {isEventNodeChangeInfo} from '../../type_guards';

/**
 * Write the event node change to the database
 */
export default async (
    transaction: Knex.Transaction,
    {table_names, event_node_change}: ITableAndColumnNames,
    eventInfo: IEventNodeChangeInfo,
    eventId: number
) => {
    if (isEventNodeChangeInfo(eventInfo)) {
        await transaction
            .table<ISqlEventNodeChangeTable>(table_names.event_node_change)
            .insert<ISqlEventNodeChangeTable>({
                [event_node_change.event_id]: eventId,
                [event_node_change.revision_data]: eventInfo.revisionData,
                [event_node_change.node_schema_version]: eventInfo.nodeSchemaVersion
            });
    } else {
        throw new Error(
            'Called data accessor for storing event node changes with a non node change event'
        );
    }
};
