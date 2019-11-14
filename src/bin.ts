#! /usr/bin/env node

import yargs from 'yargs';
import {generator} from '@social-native/snpkg-knex-migration-generator';
import path from 'path';

const p = path.resolve(__dirname, './migrations');
generator(yargs.argv, p, 'graphql_node_version', fn => fn());
