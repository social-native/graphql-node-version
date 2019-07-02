#! /usr/bin/env node

/**
 * API
 *
 * migrate:latest
 * migrate:rollback
 */

import {createRevisionMigrations} from './index';
import yargs from 'yargs';
import Knex from 'knex';

const {up} = createRevisionMigrations();

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
