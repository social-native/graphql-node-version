#! /usr/bin/env node

import {createRevisionMigrations} from './index';
import yargs from 'yargs';
import path from 'path';

import * as _kenxBin from './lib/knex/init-knex'; // tslint:disable-line

const {up, down} = createRevisionMigrations();

const kenxBin = (_kenxBin as any).default || _kenxBin;

yargs.scriptName('graphql-node-version');

yargs.command({
    command: 'migrate:revision-table',
    describe: 'Migrates the database to add the revision table',
    handler: async () => {
        const env = process.env;
        env.cwd = process.cwd();
        env.modulePath = path.join(process.cwd(), 'node_modules', 'knex');
        const opts = {} as any;
        opts.client = opts.client || 'sqlite3'; // We don't really care about client when creating migrations

        const knex = (kenxBin as any).initKnex(Object.assign({}, env), opts);

        await up(knex);
        console.log('Created revision table');
        process.exit(0);
    }
});

yargs.command({
    command: 'rollback:revision-table',
    describe: 'Rollbacks migration of the revision table',
    handler: async () => {
        const env = process.env;
        env.cwd = process.cwd();
        env.modulePath = path.join(process.cwd(), 'node_modules', 'knex');
        const opts = {} as any;
        opts.client = opts.client || 'sqlite3'; // We don't really care about client when creating migrations

        const knex = (kenxBin as any).initKnex(Object.assign({}, env), opts);

        await down(knex);
        console.log('Rolled back revision table');
        process.exit(0);
    }
});

// run!
// tslint:disable-next-line
yargs.help().argv;
