import * as Knex from 'knex';

import {INamesConfig} from '../types';
import {setNames} from '../sqlNames';

/**
 * Create tables for storing versions of a node through time
 *
 * - A base table (`event`) describes the event interface.
 * - Two implementors of the interface exist: `eventLinkChange` and `eventNodeChange`
 * - The types of implementors that exist are in the `eventImplementorType` table
 * - `eventLinkChange` captures information about how edges of the node change
 * - `eventNodeChange` captures information about how the node's fields changes
 * - In some cases, a node is composed of other nodes. AKA: it is made up of node fragments.
 * For this case, `eventNodeChangeFragment` captures information about the fragment nodes that make up the whole node
 * - Information about the user that caused an event is captured in the `event`, `userRole`, and `role` tables
 */
interface IConfig extends INamesConfig {
    revisionRole: string[];
}

export default (config?: IConfig) => {
    const {tableNames, columnNames} = setNames(config || {});

    const up = async (knex: Knex) => {
        await knex.schema.createTable(tableNames.eventImplementorType, t => {
            t.increments(columnNames.eventImplementorTypeId)
                .unsigned()
                .primary();
            t.string(columnNames.eventImplementorType).notNullable();
        });

        await knex.schema.createTable(tableNames.event, t => {
            t.increments(columnNames.eventId)
                .unsigned()
                .primary();
            t.integer(`${tableNames.eventImplementorType}_${columnNames.eventImplementorTypeId}`)
                .unsigned()
                .notNullable()
                .references(columnNames.eventImplementorTypeId)
                .inTable(tableNames.eventImplementorType);
            t.timestamp(columnNames.eventTime).notNullable();
            t.string(columnNames.eventUserId).notNullable();
            t.string(columnNames.eventNodeName).notNullable();
            t.string(columnNames.eventNodeId).notNullable();
            t.string(columnNames.eventResolverOperation).notNullable();
        });

        await knex.schema.createTable(tableNames.eventLinkChange, t => {
            t.increments(columnNames.linkChangeId)
                .unsigned()
                .primary();
            t.integer(`${tableNames.event}_${columnNames.eventId}`)
                .unsigned()
                .notNullable()
                .references(columnNames.eventId)
                .inTable(tableNames.event);
            t.string(columnNames.linkChangeNodeNameA).notNullable();
            t.string(columnNames.linkChangeNodeIdA).notNullable();
            t.string(columnNames.linkChangeNodeNameB).notNullable();
            t.string(columnNames.linkChangeNodeIdB).notNullable();
        });

        await knex.schema.createTable(tableNames.eventNodeChange, t => {
            t.increments(columnNames.nodeChangeId)
                .unsigned()
                .primary();
            t.integer(`${tableNames.event}_${columnNames.eventId}`)
                .unsigned()
                .notNullable()
                .references(columnNames.eventId)
                .inTable(tableNames.event);
            t.json(columnNames.nodeChangeRevisionData).notNullable();
            t.integer(columnNames.nodeChangeNodeSchemaVersion).notNullable();
        });

        await knex.schema.createTable(tableNames.eventNodeChangeFragment, t => {
            t.increments(columnNames.nodeChangeFragmentId)
                .unsigned()
                .primary();
            t.timestamp(columnNames.nodeChangeFragmentTime).notNullable();
            t.string(columnNames.nodeChangeFragmentParentNodeId).notNullable();
            t.string(columnNames.nodeChangeFragmentParentNodeName).notNullable();
            t.string(columnNames.nodeChangeFragmentChildNodeId).notNullable();
            t.string(columnNames.nodeChangeFragmentChildNodeName).notNullable();
        });

        await knex.schema.createTable(tableNames.nodeSnapshot, t => {
            t.increments(columnNames.snapshotId)
                .unsigned()
                .primary();

            t.timestamp(columnNames.snapshotTime).notNullable();
            t.integer(`${tableNames.event}_${columnNames.eventId}`)
                .unsigned()
                .notNullable()
                .references(columnNames.eventId)
                .inTable(tableNames.event);
            t.integer(columnNames.snapshotNodeSchemaVersion).notNullable();
            t.json(columnNames.snapshotData).notNullable();
        });

        await knex.schema.createTable(tableNames.role, t => {
            t.increments(columnNames.roleId)
                .unsigned()
                .primary();
            t.string(columnNames.roleName)
                .notNullable()
                .unique();
        });

        return await knex.schema.createTable(tableNames.userRole, t => {
            t.increments(columnNames.userRoleId)
                .unsigned()
                .primary();
            t.integer(`${tableNames.event}_${columnNames.eventId}`)
                .unsigned()
                .notNullable()
                .references(columnNames.eventId)
                .inTable(tableNames.event);
            t.integer(`${tableNames.role}_${columnNames.roleId}`)
                .unsigned()
                .notNullable()
                .references(columnNames.roleId)
                .inTable(tableNames.role);
        });
    };

    const down = async (knex: Knex) => {
        await knex.schema.dropTable(tableNames.userRole);
        await knex.schema.dropTable(tableNames.role);
        await knex.schema.dropTable(tableNames.eventNodeChangeFragment);
        await knex.schema.dropTable(tableNames.eventNodeChange);
        await knex.schema.dropTable(tableNames.eventLinkChange);
        await knex.schema.dropTable(tableNames.event);
        return await knex.schema.dropTable(tableNames.eventImplementorType);
    };

    return {up, down};
};
