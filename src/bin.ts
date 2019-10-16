#! /usr/bin/env node

// import {createRevisionMigrations} from './index';
import yargs from 'yargs';
import path from 'path';
import fs from 'fs';
import Bluebird from 'bluebird';
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
        // const versionFileNamePath = path.resolve(knex.migrate.config.directory, versionFileName);
        // const migrationContents = createRevisionMigrations(
        //     undefined,
        //     knex.migrate.config.extension
        // );

        // const existingMigrations = [] as string[];
        const existingMigrations = fs.readdirSync(knex.migrate.config.directory);
        // , (_err: any, files: string[]) => {
        // existingMigrations.forEach(file => {
        //     console.log('EXISTING MIGRATION:', file);
        //     existingMigrations.push(file);
        // });
        // // });
        // console.log('EXISTING MIGRATION: ', fileName);

        // let filenames = [];
        const libMigrationDir = path.resolve('./src/migrations');
        console.log('libMigrationDir', libMigrationDir);

        const matchMigration = /(.*).(ts|js)/;

        const newMigrations = [] as Array<{migrationName: string; fileName: string}>;
        const libMigrationFiles = fs.readdirSync(libMigrationDir);
        // , (_err: any, files: string[]) => {
        libMigrationFiles.forEach(fileName => {
            console.log('LOOKING AT EXISTING MIGRATION: ', fileName);

            const match = fileName.match(matchMigration);
            const potentialMigrationName = match && match[1];
            if (potentialMigrationName) {
                const matchingMigration = existingMigrations.find(m =>
                    m.includes(potentialMigrationName)
                );

                if (matchingMigration === undefined) {
                    console.log('EXISTING MIGRATION MATCHES?: ', 'NO');
                    newMigrations.push({fileName, migrationName: potentialMigrationName});
                } else {
                    console.log('EXISTING MIGRATION MATCHES?: ', 'YES');
                }
            }
        });
        // });
        console.log('NEW MIGRATIONS: ', newMigrations);

        const LIB_NAME = 'graphql_node_version';
        await Bluebird.mapSeries(newMigrations, async ({migrationName, fileName}) => {
            const newMigrationFileNamePath = await knex.migrate.make(
                `${LIB_NAME}_${migrationName}`
            );
            console.log('MADE A NEW MIGRATION FILE AT: ', newMigrationFileNamePath);

            const libMigrationFilePath = path.resolve(libMigrationDir, fileName);
            console.log('Importing lib migration file at path: ', libMigrationFilePath);

            const migrationFile = require(libMigrationFilePath);
            console.log(
                '********',
                migrationFile.default()(LIB_NAME, knex.migrate.config.extension)
            );
            fs.writeFile(
                newMigrationFileNamePath,
                migrationFile.default()(LIB_NAME, knex.migrate.config.extension),
                err => {
                    if (err) {
                        throw err;
                    }

                    console.log('Migration saved!');
                }
            );
        });
        // newMigrations.forEach();

        // console.log(versionFileNamePath);
        // console.log(knex.migrate);
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
