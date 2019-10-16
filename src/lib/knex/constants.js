// tslint:disable

const { keys } = require('lodash');

/**
 * ********************************************************************
 * From: https://github.com/tgriesser/knex/blob/master/bin/utils/constants.js
 * ********************************************************************
 */

const DEFAULT_EXT = 'js';
const DEFAULT_TABLE_NAME = 'knex_migrations_version';

/**
 * ********************************************************************
 * From: https://github.com/tgriesser/knex/blob/master/src/constants.js
 * ********************************************************************
 */

// The client names we'll allow in the `{name: lib}` pairing.
const CLIENT_ALIASES = Object.freeze({
  pg: 'postgres',
  postgresql: 'postgres',
  sqlite: 'sqlite3',
});

const SUPPORTED_CLIENTS = Object.freeze(
  [
    'mssql',
    'mysql',
    'mysql2',
    'oracledb',
    'postgres',
    'redshift',
    'sqlite3',
  ].concat(keys(CLIENT_ALIASES))
);

const POOL_CONFIG_OPTIONS = Object.freeze([
  'maxWaitingClients',
  'testOnBorrow',
  'fifo',
  'priorityRange',
  'autostart',
  'evictionRunIntervalMillis',
  'numTestsPerRun',
  'softIdleTimeoutMillis',
  'Promise',
]);

module.exports = {
  CLIENT_ALIASES,
  SUPPORTED_CLIENTS,
  POOL_CONFIG_OPTIONS,
  DEFAULT_EXT,
  DEFAULT_TABLE_NAME,
};

// tslint:enable
