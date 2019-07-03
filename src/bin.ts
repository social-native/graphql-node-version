#! /usr/bin/env node

/**
 * API
 *
 * migrate:latest
 * migrate:rollback
 */

import {createRevisionMigrations} from './index';
import yargs from 'yargs';
import path from 'path';

// import Knex from 'knex';
import * as _initKnex from './lib/knex/init-knex'; // tslint:disable-line

const {up} = createRevisionMigrations();

const initKnex = (_initKnex as any).default || _initKnex;

yargs.command({
    command: 'migrate:revision-table',
    describe: 'Migrates the database to add the revision table',
    handler: async () => {
        const env = process.env;
        env.cwd = process.cwd();
        env.modulePath = path.join(process.cwd(), 'node_modules', 'knex');
        const opts = {} as any;
        opts.client = opts.client || 'sqlite3'; // We don't really care about client when creating migrations

        const knex = (initKnex as any).initKnex(Object.assign({}, env), opts);

        console.log('Created revision table');
        await up(knex);
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
// console.log('hi', 'helllllo');
