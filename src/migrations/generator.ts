import * as Knex from 'knex';

import {ITableAndColumnNames} from '../types';
import {setNames} from '../sql_names';
import {EVENT_IMPLEMENTOR_TYPE_IDS, EVENT_IMPLEMENTOR_TYPE_NAMES} from 'enums';

/**
 * Create tables for storing versions of a node through time
 *
 * - A base table (`event`) describes the event interface.
 * - Two implementors of the interface exist: `event_link_change` and `event_node_change`
 * - The types of implementors that exist are in the `event_implementor_type` table
 * - `event_link_change` captures information about how edges of the node change
 * - `event_node_change` captures information about how the node's fields changes
 * - In some cases, a node is composed of other nodes. AKA: it is made up of node fragments.
 *     For this case, `event_node_change_fragment` captures information about the fragment nodes
 *     that make up the whole node
 * - Information about the user that caused an event is captured in the `event`, `user_role`, and `role` tables
 */

export default (config?: ITableAndColumnNames) => {
    const {
        table_names,
        event,
        event_implementor_type,
        event_link_change,
        event_node_change,
        event_node_fragment_register,
        role,
        user_role,
        node_snapshot
    } = setNames(config);

    const up = async (knex: Knex) => {
        await knex.schema.createTable(table_names.event_implementor_type, t => {
            t.increments(event_implementor_type.id)
                .unsigned()
                .primary();
            t.string(event_implementor_type.type).notNullable();
        });

        await knex.table(table_names.event_implementor_type).insert([
            {
                type: EVENT_IMPLEMENTOR_TYPE_NAMES.NODE_CHANGE,
                id: EVENT_IMPLEMENTOR_TYPE_IDS.NODE_CHANGE
            },
            {
                type: EVENT_IMPLEMENTOR_TYPE_NAMES.NODE_FRAGMENT_CHANGE,
                id: EVENT_IMPLEMENTOR_TYPE_IDS.NODE_FRAGMENT_CHANGE
            },
            {
                type: EVENT_IMPLEMENTOR_TYPE_NAMES.LINK_CHANGE,
                id: EVENT_IMPLEMENTOR_TYPE_IDS.LINK_CHANGE
            }
        ]);

        await knex.schema.createTable(table_names.event, t => {
            t.increments(event.id)
                .unsigned()
                .primary();
            t.integer(event.implementor_type_id)
                .unsigned()
                .notNullable()
                .references(event_implementor_type.id)
                .inTable(table_names.event_implementor_type);
            t.timestamp(event.created_at).notNullable();
            t.string(event.user_id).notNullable();
            t.string(event.node_name).notNullable();
            t.string(event.node_id).notNullable();
            t.string(event.resolver_operation).notNullable();
        });

        await knex.schema.createTable(table_names.event_link_change, t => {
            t.increments(event_link_change.id)
                .unsigned()
                .primary();
            t.integer(event_link_change.event_id)
                .unsigned()
                .notNullable()
                .references(event.id)
                .inTable(table_names.event);
            t.string(event_link_change.node_name).notNullable();
            t.string(event_link_change.node_id).notNullable();
        });

        await knex.schema.createTable(table_names.event_node_change, t => {
            t.increments(event_node_change.id)
                .unsigned()
                .primary();
            t.integer(event_node_change.event_id)
                .unsigned()
                .notNullable()
                .references(event.id)
                .inTable(table_names.event);
            t.json(event_node_change.revision_data).notNullable();
            t.string(event_node_change.node_schema_version).notNullable();
        });

        await knex.schema.createTable(table_names.event_node_fragment_register, t => {
            t.increments(event_node_fragment_register.id)
                .unsigned()
                .primary();
            t.string(event_node_fragment_register.parent_node_id).notNullable();
            t.string(event_node_fragment_register.parent_node_name).notNullable();
            t.string(event_node_fragment_register.child_node_id).notNullable();
            t.string(event_node_fragment_register.child_node_name).notNullable();
        });

        await knex.schema.createTable(table_names.node_snapshot, t => {
            t.increments(node_snapshot.id)
                .unsigned()
                .primary();

            t.integer(node_snapshot.event_id)
                .unsigned()
                .notNullable()
                .references(event.id)
                .inTable(table_names.event);

            t.json(node_snapshot.snapshot).notNullable();
            t.string(node_snapshot.node_schema_version).notNullable();
        });

        await knex.schema.createTable(table_names.role, t => {
            t.increments(role.id)
                .unsigned()
                .primary();
            t.string(role.role)
                .notNullable()
                .unique();
        });

        return await knex.schema.createTable(table_names.user_role, t => {
            t.increments(user_role.id)
                .unsigned()
                .primary();
            t.integer(user_role.event_id)
                .unsigned()
                .notNullable()
                .references(event.id)
                .inTable(table_names.event);
            t.integer(user_role.role_id)
                .unsigned()
                .notNullable()
                .references(role.id)
                .inTable(table_names.role);
        });
    };

    const down = async (knex: Knex) => {
        await knex.schema.dropTable(table_names.user_role);
        await knex.schema.dropTable(table_names.role);
        await knex.schema.dropTable(table_names.event_node_fragment_register);
        await knex.schema.dropTable(table_names.event_node_change);
        await knex.schema.dropTable(table_names.event_link_change);
        await knex.schema.dropTable(table_names.node_snapshot);
        await knex.schema.dropTable(table_names.event);
        return await knex.schema.dropTable(table_names.event_implementor_type);
    };

    return {up, down};
};
