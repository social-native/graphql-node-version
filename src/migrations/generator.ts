import * as Knex from 'knex';

import {INamesConfig} from '../types';
import {setNames} from '../sqlNames';

/**
 * Crates a table for storing revision
 */
interface IConfig extends INamesConfig {
    revisionRole: string[];
}

export default (config?: IConfig) => {
    const {tableNames, columnNames} = setNames(config || {});

    const up = async (knex: Knex) => {
        const revision = await knex.schema.createTable(tableNames.revision, t => {
            t.increments('id')
                .unsigned()
                .primary();
            t.timestamp(columnNames.revisionTime).defaultTo(knex.fn.now());

            t.string(columnNames.userId);
            t.json(columnNames.revisionData);
            t.string(columnNames.nodeName);
            t.integer(columnNames.nodeVersion);
            t.integer(columnNames.nodeId);
            t.string(columnNames.resolverName);
        });

        await knex.schema.createTable(tableNames.revisionNodeSnapshot, t => {
            t.increments('id')
                .unsigned()
                .primary();

            t.timestamp(columnNames.revisionTime).defaultTo(knex.fn.now());

            t.integer(`${tableNames.revision}_id`)
                .unsigned()
                .notNullable()
                .references('id')
                .inTable(tableNames.revision);
            t.json(columnNames.snapshot);
        });

        if (tableNames.revisionRole && tableNames.revisionUserRole) {
            await knex.schema.createTable(tableNames.revisionRole, t => {
                t.increments('id')
                    .unsigned()
                    .primary();
                t.string(columnNames.roleName)
                    .notNullable()
                    .unique();
            });

            return await knex.schema.createTable(tableNames.revisionUserRole, t => {
                t.increments('id')
                    .unsigned()
                    .primary();
                t.integer(`${tableNames.revision}_id`)
                    .unsigned()
                    .notNullable()
                    .references('id')
                    .inTable(tableNames.revision);
                t.integer(`${tableNames.revisionRole}_id`)
                    .unsigned()
                    .notNullable()
                    .references('id')
                    .inTable(tableNames.revisionRole);
            });
        } else {
            return revision;
        }
    };

    const down = async (knex: Knex) => {
        if (tableNames.revisionRole && tableNames.revisionUserRole) {
            await knex.schema.dropTable(tableNames.revisionUserRole);
            await knex.schema.dropTable(tableNames.revisionRole);
        }
        await knex.schema.dropTable(tableNames.revisionNodeSnapshot);
        return await knex.schema.dropTable(tableNames.revision);
    };

    return {up, down};
};
