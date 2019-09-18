#! /usr/bin/env node
'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

require('snpkg-snapi-connections');
var yargs = _interopDefault(require('yargs'));
var path = _interopDefault(require('path'));
var tildify = _interopDefault(require('tildify'));
var colorette = _interopDefault(require('colorette'));
var getopts = _interopDefault(require('getopts'));
var lodash = _interopDefault(require('lodash'));
var fs = _interopDefault(require('fs'));

/**
 * Sets the names for tables and columns that revisions will be stored in
 *
 * Allows users to specify their own column and table names. If none are specified, the defaults will be used.
 */
var DEFAULT_TABLE_NAMES;
(function (DEFAULT_TABLE_NAMES) {
    DEFAULT_TABLE_NAMES["revision"] = "revision";
    DEFAULT_TABLE_NAMES["revisionRole"] = "revision_role";
    DEFAULT_TABLE_NAMES["revisionUserRole"] = "revision_user_roles";
    DEFAULT_TABLE_NAMES["revisionNodeSnapshot"] = "revision_node_snapshot";
})(DEFAULT_TABLE_NAMES || (DEFAULT_TABLE_NAMES = {}));
var DEFAULT_COLUMN_NAMES;
(function (DEFAULT_COLUMN_NAMES) {
    DEFAULT_COLUMN_NAMES["id"] = "id";
    DEFAULT_COLUMN_NAMES["userId"] = "user_id";
    // userRoles = 'user_roles',
    DEFAULT_COLUMN_NAMES["revisionData"] = "revision";
    DEFAULT_COLUMN_NAMES["revisionTime"] = "created_at";
    DEFAULT_COLUMN_NAMES["nodeSchemaVersion"] = "node_schema_version";
    DEFAULT_COLUMN_NAMES["nodeName"] = "node_name";
    DEFAULT_COLUMN_NAMES["nodeId"] = "node_id";
    DEFAULT_COLUMN_NAMES["roleName"] = "role_name";
    DEFAULT_COLUMN_NAMES["resolverName"] = "resolver_name";
    DEFAULT_COLUMN_NAMES["snapshot"] = "previous_node_version_snapshot";
})(DEFAULT_COLUMN_NAMES || (DEFAULT_COLUMN_NAMES = {}));
const setNames = ({ tableNames, columnNames }) => ({
    tableNames: {
        ...DEFAULT_TABLE_NAMES,
        ...tableNames
    },
    columnNames: {
        ...DEFAULT_COLUMN_NAMES,
        ...columnNames
    }
});

var createRevisionMigrations = (config) => {
    const { tableNames, columnNames } = setNames(config || {});
    const up = async (knex) => {
        const revision = await knex.schema.createTable(tableNames.revision, t => {
            t.increments('id')
                .unsigned()
                .primary();
            t.timestamp(columnNames.revisionTime).defaultTo(knex.fn.now());
            t.string(columnNames.userId);
            t.json(columnNames.revisionData);
            t.string(columnNames.nodeName);
            t.integer(columnNames.nodeSchemaVersion);
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
        }
        else {
            return revision;
        }
    };
    const down = async (knex) => {
        if (tableNames.revisionRole && tableNames.revisionUserRole) {
            await knex.schema.dropTable(tableNames.revisionUserRole);
            await knex.schema.dropTable(tableNames.revisionRole);
        }
        await knex.schema.dropTable(tableNames.revisionNodeSnapshot);
        return await knex.schema.dropTable(tableNames.revision);
    };
    return { up, down };
};

const { keys } = lodash;

/**
 * ********************************************************************
 * From: https://github.com/tgriesser/knex/blob/master/bin/utils/constants.js
 * ********************************************************************
 */

const DEFAULT_EXT = 'js';
const DEFAULT_TABLE_NAME = 'knex_migrations';

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

var constants = {
  CLIENT_ALIASES,
  SUPPORTED_CLIENTS,
  POOL_CONFIG_OPTIONS,
  DEFAULT_EXT,
  DEFAULT_TABLE_NAME,
};

/**
 * ********************************************************************
 * From: https://github.com/tgriesser/knex/blob/master/src/helpers.js
 * ********************************************************************
 */

/* eslint no-console:0 */
const {
    isFunction,
    isUndefined,
    isPlainObject,
    isArray,
    isTypedArray,
  } = lodash;
  const { CLIENT_ALIASES: CLIENT_ALIASES$1 } = constants;
  
  // Check if the first argument is an array, otherwise uses all arguments as an
  // array.
  
  function normalizeArr() {
    const args = new Array(arguments.length);
    for (let i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    if (Array.isArray(args[0])) {
      return args[0];
    }
    return args;
  }
  
  function containsUndefined(mixed) {
    let argContainsUndefined = false;
  
    if (isTypedArray(mixed)) return false;
  
    if (mixed && isFunction(mixed.toSQL)) {
      //Any QueryBuilder or Raw will automatically be validated during compile.
      return argContainsUndefined;
    }
  
    if (isArray(mixed)) {
      for (let i = 0; i < mixed.length; i++) {
        if (argContainsUndefined) break;
        argContainsUndefined = this.containsUndefined(mixed[i]);
      }
    } else if (isPlainObject(mixed)) {
      for (const key in mixed) {
        if (mixed.hasOwnProperty(key)) {
          if (argContainsUndefined) break;
          argContainsUndefined = this.containsUndefined(mixed[key]);
        }
      }
    } else {
      argContainsUndefined = isUndefined(mixed);
    }
  
    return argContainsUndefined;
  }
  
  function addQueryContext(Target) {
    // Stores or returns (if called with no arguments) context passed to
    // wrapIdentifier and postProcessResponse hooks
    Target.prototype.queryContext = function(context) {
      if (isUndefined(context)) {
        return this._queryContext;
      }
      this._queryContext = context;
      return this;
    };
  }
  
  function resolveClientNameWithAliases(clientName) {
    return CLIENT_ALIASES$1[clientName] || clientName;
  }
  
  var helpers = {
    addQueryContext,
    containsUndefined,
    normalizeArr,
    resolveClientNameWithAliases,
  };

const { DEFAULT_EXT: DEFAULT_EXT$1, DEFAULT_TABLE_NAME: DEFAULT_TABLE_NAME$1 } = constants;
const { resolveClientNameWithAliases: resolveClientNameWithAliases$1 } = helpers;


/**
 * ********************************************************************
 * From: https://github.com/tgriesser/knex/blob/master/bin/utils/cli-config-utils.js
 * ********************************************************************
 */

function mkConfigObj(opts) {
  if (!opts.client) {
    const path = resolveDefaultKnexfilePath();
    throw new Error(
      `No default configuration file '${path}' found and no commandline connection parameters passed`
    );
  }

  const envName = opts.env || process.env.NODE_ENV || 'development';
  const resolvedClientName = resolveClientNameWithAliases$1(opts.client);
  const useNullAsDefault = resolvedClientName === 'sqlite3';
  return {
    ext: DEFAULT_EXT$1,
    [envName]: {
      useNullAsDefault,
      client: opts.client,
      connection: opts.connection,
      migrations: {
        directory: opts.migrationsDirectory,
        tableName: opts.migrationsTableName || DEFAULT_TABLE_NAME$1,
      },
    },
  };
}

function resolveKnexFilePath() {
  const jsPath = resolveDefaultKnexfilePath('js');
  if (fs.existsSync(jsPath)) {
    return {
      path: jsPath,
      extension: 'js',
    };
  }

  const tsPath = resolveDefaultKnexfilePath('ts');
  if (fs.existsSync(tsPath)) {
    return {
      path: tsPath,
      extension: 'ts',
    };
  }

  console.warn(
    `Failed to find configuration at default location of ${resolveDefaultKnexfilePath(
      'js'
    )}`
  );
}

function resolveDefaultKnexfilePath(extension) {
  return process.cwd() + `/knexfile.${extension}`;
}

var cliConfigUtils = {
  mkConfigObj,
  resolveKnexFilePath,
};

const argv = getopts(process.argv.slice(2));

const {mkConfigObj: mkConfigObj$1, resolveKnexFilePath: resolveKnexFilePath$1} = cliConfigUtils;

function exit(text) {
    if (text instanceof Error) {
        console.error(colorette.red(`${text.detail ? `${text.detail}\n` : ''}${text.stack}`));
    } else {
        console.error(colorette.red(text));
    }
    process.exit(1);
}

function checkLocalModule(env) {
    if (!env.modulePath) {
        console.log(colorette.red('No local knex install found in:'), colorette.magenta(tildify(env.cwd)));
        exit('Try running: npm install knex');
    }
}

function initKnex(env, opts) {
    checkLocalModule(env);
    if (process.cwd() !== env.cwd) {
        process.chdir(env.cwd);
        console.log('Working directory changed to', colorette.magenta(tildify(env.cwd)));
    }

    if (!opts.knexfile) {
        const configurationPath = resolveKnexFilePath$1();
        const configuration = configurationPath ? require(configurationPath.path) : undefined;

        env.configuration = configuration || mkConfigObj$1(opts);
        if (!env.configuration.ext && configurationPath) {
            env.configuration.ext = configurationPath.extension;
        }
    }
    // If knexfile is specified
    else {
        const resolvedKnexfilePath = path.resolve(opts.knexfile);
        const knexfileDir = path.dirname(resolvedKnexfilePath);
        process.chdir(knexfileDir);
        env.configuration = require(resolvedKnexfilePath);

        if (!env.configuration) {
            exit(
                'Knexfile not found. Specify a path with --knexfile or pass --client and --connection params in commandline'
            );
        }

        if (!env.configuration.ext) {
            env.configuration.ext = path.extname(resolvedKnexfilePath).replace('.', '');
        }
    }

    const resolvedConfig = resolveEnvironmentConfig(opts, env.configuration);
    const knex = require(env.modulePath);
    return knex(resolvedConfig);
}

function resolveEnvironmentConfig(opts, allConfigs) {
    const environment = opts.env || process.env.NODE_ENV || 'development';
    const result = allConfigs[environment] || allConfigs;

    if (allConfigs[environment]) {
        console.log('Using environment:', colorette.magenta(environment));
    }

    if (!result) {
        console.log(colorette.red('Warning: unable to read knexfile config'));
        process.exit(1);
    }

    if (argv.debug !== undefined) {
        result.debug = argv.debug;
    }

    return result;
}

var initKnex_1 = {
    initKnex,
};
var initKnex_2 = initKnex_1.initKnex;

var _kenxBin = /*#__PURE__*/Object.freeze({
    'default': initKnex_1,
    __moduleExports: initKnex_1,
    initKnex: initKnex_2
});

const { up, down } = createRevisionMigrations();
const kenxBin = initKnex_1 || _kenxBin;
yargs.scriptName('graphql-node-version');
yargs.command({
    command: 'migrate:revision-table',
    describe: 'Migrates the database to add the revision table',
    handler: async (args) => {
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
        };
        opts.client = opts.client || 'sqlite3'; // We don't really care about client when creating migrations
        const knex = kenxBin.initKnex(Object.assign({}, env), opts);
        await up(knex);
        console.log('Created revision table');
        process.exit(0);
    }
});
yargs.command({
    command: 'rollback:revision-table',
    describe: 'Rollbacks migration of the revision table',
    handler: async (args) => {
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
        };
        const knex = kenxBin.initKnex(Object.assign({}, env), opts);
        await down(knex);
        console.log('Rolled back revision table');
        process.exit(0);
    }
});
// run!
// tslint:disable-next-line
yargs.help().argv;
