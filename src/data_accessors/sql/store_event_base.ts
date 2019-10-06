import Knex from 'knex';
import {ITableAndColumnNames, ISqlEventTable, AllEventInfo} from '../../types';
import {
    isEventNodeChangeInfo,
    isEventLinkChangeInfo,
    isEventNodeFragmentRegisterInfo
} from '../../type_guards';
import {EVENT_IMPLEMENTOR_TYPE_IDS} from '../../enums';
import {getTxInsertId} from './utils';

/**
 * Write the event to the base event table in the database
 */
export default async (
    knex: Knex,
    transaction: Knex.Transaction,
    {table_names}: ITableAndColumnNames,
    eventInfo: AllEventInfo
) => {
    // tslint:disable-next-line
    if (isEventNodeFragmentRegisterInfo(eventInfo)) {
        throw new Error(
            'Called data accessor for storing user roles with an event that doesnt contain user role information'
        );
    }

    let implementorTypeId: number;
    if (isEventNodeChangeInfo(eventInfo)) {
        implementorTypeId = EVENT_IMPLEMENTOR_TYPE_IDS.NODE_CHANGE;
    } else if (isEventNodeFragmentRegisterInfo(eventInfo)) {
        implementorTypeId = EVENT_IMPLEMENTOR_TYPE_IDS.NODE_FRAGMENT_CHANGE;
    } else if (isEventLinkChangeInfo(eventInfo)) {
        implementorTypeId = EVENT_IMPLEMENTOR_TYPE_IDS.LINK_CHANGE;
    } else {
        throw new Error('Unknown event type. Could find find implementor ID');
    }

    // Get the id for event implementor EVENT_NODE_CHANGE
    await transaction.table<ISqlEventTable>(table_names.event).insert<ISqlEventTable>({
        created_at: eventInfo.createdAt,
        user_id: eventInfo.userId,
        node_name: eventInfo.nodeName,
        node_id: eventInfo.nodeId as string,
        resolver_operation: eventInfo.resolverOperation,
        implementor_type_id: implementorTypeId
    });

    const eventId = await getTxInsertId(knex, transaction);

    if (eventId === undefined) {
        throw new Error(`Error retrieving event id for event ${JSON.stringify(eventInfo)}`);
    }
    return eventId;
};
