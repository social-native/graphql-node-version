#! /usr/bin/env node
'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var yargs = _interopDefault(require('yargs'));
var Knex = _interopDefault(require('knex'));

const setNames = ({ tableNames, columnNames }) => ({
    tableNames: {
        main: 'revisions',
        roles: 'roles',
        ...tableNames
    },
    columnNames: {
        userId: 'user_id',
        userRoles: 'user_roles',
        revisionData: 'revision',
        revisionTime: 'created_at',
        nodeVersion: 'node_version',
        nodeName: 'node_name',
        ...columnNames
    }
});
const createRevisionMigrations = (config) => {
    const { tableNames, columnNames } = setNames(config || {});
    const up = (knex) => {
        console.log('hereeee', knex);
        return knex.schema.createTable(tableNames.main, t => {
            t.increments('id')
                .unsigned()
                .primary();
            t.timestamp(columnNames.revisionTime).defaultTo(knex.fn.now());
            t.string(columnNames.userId);
            t.json(columnNames.revisionData);
            t.string(columnNames.nodeName);
            t.integer(columnNames.nodeVersion);
        });
    };
    const down = (knex) => {
        return knex.schema.dropTable(tableNames.main);
    };
    return { up, down };
};
//# sourceMappingURL=index.js.map

/**
 * API
 *
 * migrate:latest
 * migrate:rollback
 */
const { up } = createRevisionMigrations();
yargs.command({
    command: 'migrate:revision-table',
    describe: 'Migrates the database to add the revision table',
    handler: () => {
        const knex = Knex({});
        up(knex);
        console.log('Running revision table migration');
    }
});
yargs.command({
    command: 'rollback:revision-table',
    describe: 'Rollbacks migration of the revision table',
    handler: () => {
        console.log('Rolling back revision table migration');
    }
});
console.log(yargs.argv);
console.log('hi', 'helllllo');
