import Knex from 'knex';
import {ITableAndColumnNames, ISqlEventNodeFragmentChangeTable, EventInfo} from 'types';
import {isEventNodeFragmentRegisterInfo} from 'type_guards';

/**
 * Write the event node fragment registration to the database
 */
export default async (
    transaction: Knex.Transaction,
    {table_names, event_node_fragment_register}: ITableAndColumnNames,
    eventInfo: EventInfo
) => {
    if (isEventNodeFragmentRegisterInfo(eventInfo)) {
        await transaction
            .table<ISqlEventNodeFragmentChangeTable>(table_names.event_node_fragment_register)
            .insert<ISqlEventNodeFragmentChangeTable>({
                [event_node_fragment_register.parent_node_id]: eventInfo.parentNodeId,
                [event_node_fragment_register.parent_node_name]: eventInfo.parentNodeName,
                [event_node_fragment_register.child_node_id]: eventInfo.childNodeId,
                [event_node_fragment_register.child_node_name]: eventInfo.childNodeName
            });
    } else {
        throw new Error(
            'Called data accessor for storing event node fragment registration with a non node fragment registration event'
        );
    }
};
