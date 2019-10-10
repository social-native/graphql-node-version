import Knex from 'knex';
import {ITableAndColumnNames, ISqlEventTable, AllEventInfo, ILoggerConfig} from '../../types';
import {
    isEventNodeChangeInfo,
    isEventLinkChangeInfo,
    isEventNodeFragmentRegisterInfo
} from '../../type_guards';
import {EVENT_IMPLEMENTOR_TYPE_IDS} from '../../enums';
import {getTxInsertId} from './utils';
import {getLoggerFromConfig} from '../../logger';

/**
 * Write the event to the base event table in the database
 */
export default async (
    knex: Knex,
    transaction: Knex.Transaction,
    {table_names}: ITableAndColumnNames,
    eventInfo: AllEventInfo,
    loggerConfig?: ILoggerConfig
) => {
    const parentLogger = getLoggerFromConfig(loggerConfig);
    const logger = parentLogger.child({store: 'Event base table info'});

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

    const info = {
        created_at: eventInfo.createdAt,
        user_id: eventInfo.userId,
        node_name: eventInfo.nodeName,
        node_id: eventInfo.nodeId as string,
        resolver_operation: eventInfo.resolverOperation,
        implementor_type_id: implementorTypeId
    };

    logger.debug('Storing event base table info:', info);

    // Get the id for event implementor EVENT_NODE_CHANGE
    await transaction.table<ISqlEventTable>(table_names.event).insert<ISqlEventTable>(info);

    const eventId = await getTxInsertId(knex, transaction);
    logger.debug('Returned base table ID', eventId);

    if (eventId === undefined) {
        throw new Error(`Error retrieving event id for event ${JSON.stringify(eventInfo)}`);
    }
    return eventId;
};
