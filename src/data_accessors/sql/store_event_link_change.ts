import Knex from 'knex';
import {ITableAndColumnNames, ISqlEventLinkChangeTable, IEventLinkChangeInfo} from '../../types';
import {isEventLinkChangeInfo} from '../../type_guards';

/**
 * Write the event link change to the database
 */
export default async (
    transaction: Knex.Transaction,
    {table_names, event_link_change}: ITableAndColumnNames,
    eventInfo: IEventLinkChangeInfo,
    eventId: number
) => {
    if (isEventLinkChangeInfo(eventInfo)) {
        await transaction
            .table<ISqlEventLinkChangeTable>(table_names.event_link_change)
            .insert<ISqlEventLinkChangeTable>({
                [event_link_change.event_id]: eventId,
                [event_link_change.node_id]: eventInfo.linkNodeId,
                [event_link_change.node_name]: eventInfo.linkNodeName
            });
    } else {
        throw new Error(
            'Called data accessor for storing event link changes with a non link change event'
        );
    }
};
