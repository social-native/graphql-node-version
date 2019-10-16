#! /usr/bin/env node

import {createRevisionMigrations} from './index';
import yargs from 'yargs';
import path from 'path';
import fs from 'fs';

import * as _kenxBin from './lib/knex/init-knex'; // tslint:disable-line

// const {up, down} = createRevisionMigrations();

const kenxBin = (_kenxBin as any).default || _kenxBin;

yargs.scriptName('graphql-node-version');

yargs.command({
    command: 'migrate:revision-table',
    describe: 'Migrates the database to add the revision table',
    handler: async args => {
        const env = process.env;
        env.cwd = process.cwd();
        env.modulePath = path.join(process.cwd(), 'node_modules', 'knex');
        const opts = {
            client: args.client || 'sqlite3',
            cwd: args.cwd,
            knexfile: args.knexfile,
            knexpath: args.knexpath,
            require: args.require,
            completion: args.completion
        } as any;

        opts.client = opts.client || 'sqlite3'; // We don't really care about client when creating migrations

        const knex = (kenxBin as any).initKnex(Object.assign({}, env), opts);
        // const list = await knex.migrate.latest({tableName: 'knex_migration_versions'});
        const versionFileName = await knex.migrate.make('$_create_graphql_node_version_tables');
        const versionFileNamePath = path.resolve(knex.migrate.config.directory, versionFileName);
        const migrationContents = createRevisionMigrations(
            undefined,
            knex.migrate.config.extension
        );
        fs.writeFile(versionFileNamePath, migrationContents.migration, err => {
            if (err) {
                throw err;
            }

            console.log('Migration saved!');
        });
        // console.log(versionFileNamePath);
        console.log(knex.migrate);
        // // console.log('LIST', list);
        // await up(knex);
        // console.log('Created revision table'); // tslint:disable-line
        // process.exit(0);
    }
});

yargs.command({
    command: 'rollback:revision-table',
    describe: 'Rollbacks migration of the revision table',
    handler: async args => {
        const env = process.env;
        env.cwd = process.cwd();
        env.modulePath = path.join(process.cwd(), 'node_modules', 'knex');
        const opts = {
            client: args.client || 'sqlite3',
            cwd: args.cwd,
            knexfile: args.knexfile,
            knexpath: args.knexpath,
            require: args.require,
            completion: args.completion
        } as any;

        const knex = (kenxBin as any).initKnex(Object.assign({}, env), opts);
        console.log(knex);
        // await down(knex);
        console.log('Rolled back revision table'); // tslint:disable-line
        process.exit(0);
    }
});

// run!
// tslint:disable-next-line
yargs.help().argv;
