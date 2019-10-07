import Knex from 'knex';
import Bluebird from 'bluebird';
import {
    ITableAndColumnNames,
    AllEventInfo,
    PersistVersion,
    IConfig,
    ILoggerConfig
} from '../../types';
import storeEventBase from './store_event_base';
import storeUserRoles from './store_user_roles';
import storeEventLinkChange from './store_event_link_change';
import storeEventNodeChange from './store_event_node_change';
import storeEventNodeFragmentRegistration from './store_event_node_fragment_registration';
import storeNodeSnapshot from './store_node_snapshot';
import {isEventNodeChangeWithSnapshotInfo} from '../../type_guards';
import {setNames} from 'sql_names';
import {getLoggerFromConfig} from 'logger';

export {default as createQueryShouldStoreSnapshot} from './query_should_store_snapshot';

export const persistVersion = (knex: Knex, trx: Knex.Transaction, config: IConfig) => {
    const tableAndColumnNames = setNames(config ? config.names : undefined);
    const parentLogger = getLoggerFromConfig(config);

    const logger = parentLogger.child({api: 'Data Accessors - Persist Version'});

    return (async versionInfo => {
        if (versionInfo.nodeChange) {
            const eventId = await createEventAndUserRoles(
                knex,
                trx,
                tableAndColumnNames,
                versionInfo.nodeChange,
                {logger}
            );
            await storeEventNodeChange(trx, tableAndColumnNames, versionInfo.nodeChange, eventId);
            if (isEventNodeChangeWithSnapshotInfo(versionInfo.nodeChange)) {
                await storeNodeSnapshot(trx, tableAndColumnNames, versionInfo.nodeChange, eventId);
            }
        }

        if (versionInfo.linkChanges) {
            await Bluebird.each(versionInfo.linkChanges, async event => {
                const eventId = await createEventAndUserRoles(
                    knex,
                    trx,
                    tableAndColumnNames,
                    event
                );
                await storeEventLinkChange(trx, tableAndColumnNames, event, eventId);
            });
        }
        if (versionInfo.fragmentRegistration) {
            await storeEventNodeFragmentRegistration(
                trx,
                tableAndColumnNames,
                versionInfo.fragmentRegistration
            );
        }
    }) as PersistVersion;
};

const createEventAndUserRoles = async (
    knex: Knex,
    trx: Knex.Transaction,
    tableAndColumnNames: ITableAndColumnNames,
    eventLinkChangeInfo: AllEventInfo,
    loggerConfig?: ILoggerConfig
): Promise<number> => {
    const parentLogger = getLoggerFromConfig(loggerConfig);
    const logger = parentLogger.child({step: 'createEventAndUserRoles'});

    const eventId = await storeEventBase(knex, trx, tableAndColumnNames, eventLinkChangeInfo, {
        logger
    });

    await storeUserRoles(trx, tableAndColumnNames, eventLinkChangeInfo, eventId, {logger});
    return eventId;
};
