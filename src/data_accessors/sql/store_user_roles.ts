import Knex from 'knex';
import {ITableAndColumnNames, AllEventInfo, ISqlRoleTable} from '../../types';
import {isEventNodeFragmentRegisterInfo} from '../../type_guards';

/**
 * Write the event to the base event table in the database
 */
export default async (
    transaction: Knex.Transaction,
    {table_names, role, user_role}: ITableAndColumnNames,
    eventInfo: AllEventInfo,
    eventId: number
) => {
    if (isEventNodeFragmentRegisterInfo(eventInfo)) {
        throw new Error(
            'Called data accessor for storing user roles with an event that doesnt contain user role information'
        );
    }

    // Calculate which role are missing in the db
    let allRoles;
    const foundRolesQueryResult = (await transaction
        .table<ISqlRoleTable>(table_names.role)
        .whereIn(role.role, eventInfo.userRoles)) as ISqlRoleTable[];

    const foundRoleNames = foundRolesQueryResult.map((n: any) => n[role.role]);
    const missingRoles = eventInfo.userRoles.filter(i => foundRoleNames.indexOf(i) < 0);

    // If there are any missing roles, add them to the database
    if (missingRoles.length > 0) {
        // Insert the missing roles
        await transaction.table(table_names.role).insert(
            missingRoles.map(r => ({
                [role.role]: r
            }))
        );
        // Select the role ids
        allRoles = (await transaction
            .table(table_names.role)
            .whereIn(role.role, eventInfo.userRoles)) as ISqlRoleTable[];
    } else {
        allRoles = foundRolesQueryResult;
    }

    // Insert roles ids associated with the revision id
    await transaction.table(table_names.user_role).insert(
        allRoles.map((roleQueryResult: any) => ({
            [user_role.role_id]: roleQueryResult[role.id],
            [user_role.event_id]: eventId
        }))
    );
};
