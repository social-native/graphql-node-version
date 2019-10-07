#! /usr/bin/env node
'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

require('@social-native/snpkg-snapi-ndm');
require('bluebird');
var yargs = _interopDefault(require('yargs'));
var path = _interopDefault(require('path'));
var tildify = _interopDefault(require('tildify'));
var colorette = _interopDefault(require('colorette'));
var getopts = _interopDefault(require('getopts'));
var lodash = _interopDefault(require('lodash'));
var fs = _interopDefault(require('fs'));

/**
 * Sets the names for tables and columns that node version info will be stored in
 *
 * Allows users to specify their own column and table names. If none are specified, the defaults will be used.
 */
/**
 * TABLE NAMES
 */
const DEFAULT_SQL_TABLE_NAMES = {
    event: 'version_event',
    event_implementor_type: 'version_event_implementor_type',
    event_link_change: 'version_event_link_change',
    event_node_change: 'version_event_node_change',
    event_node_fragment_register: 'version_event_node_fragment_register',
    role: 'version_role',
    user_role: 'version_user_role',
    node_snapshot: 'version_node_snapshot'
};
/**
 * COLUMN NAMES
 */
const DEFAULT_COLUMN_NAMES_EVENT_TABLE = {
    id: 'id',
    created_at: 'created_at',
    user_id: 'user_id',
    node_name: 'node_name',
    node_id: 'node_id',
    resolver_operation: 'resolver_operation',
    implementor_type_id: 'implementor_type_id'
};
const DEFAULT_COLUMN_NAMES_EVENT_IMPLEMENTOR_TYPE_TABLE = {
    id: 'id',
    type: 'type'
};
const DEFAULT_COLUMN_NAMES_EVENT_LINK_CHANGE_TABLE = {
    id: 'id',
    event_id: 'event_id',
    node_name: 'node_name',
    node_id: 'node_id'
};
const DEFAULT_COLUMN_NAMES_EVENT_NODE_CHANGE_TABLE = {
    id: 'id',
    event_id: 'event_id',
    revision_data: 'revision_data',
    node_schema_version: 'schema_version'
};
const DEFAULT_COLUMN_NAMES_EVENT_NODE_FRAGMENT_REGISTER_TABLE = {
    id: 'id',
    parent_node_id: 'parent_node_id',
    parent_node_name: 'parent_node_name',
    child_node_id: 'child_node_id',
    child_node_name: 'child_node_name'
};
const DEFAULT_COLUMN_NAMES_ROLE_TABLE = {
    id: 'id',
    role: 'role'
};
const DEFAULT_COLUMN_NAMES_USER_ROLE_TABLE = {
    id: 'id',
    role_id: 'role_id',
    event_id: 'event_id'
};
const DEFAULT_COLUMN_NAMES_SNAPSHOT_TABLE = {
    id: 'id',
    event_id: 'event_id',
    snapshot: 'snapshot',
    node_schema_version: 'node_schema_version'
};
/**
 * Override default table and column names
 */
const setNames = (names) => {
    // tslint:disable
    const tableNames = names && names.table_names;
    const event = names && names.event;
    const event_implementor_type = names && names.event_implementor_type;
    const event_link_change = names && names.event_link_change;
    const event_node_change = names && names.event_node_change;
    const event_node_fragment_register = names && names.event_node_fragment_register;
    const role = names && names.role;
    const user_role = names && names.user_role;
    const node_snapshot = names && names.node_snapshot;
    // tslint:enable
    return {
        table_names: {
            ...DEFAULT_SQL_TABLE_NAMES,
            ...tableNames
        },
        event: {
            ...DEFAULT_COLUMN_NAMES_EVENT_TABLE,
            ...event
        },
        event_implementor_type: {
            ...DEFAULT_COLUMN_NAMES_EVENT_IMPLEMENTOR_TYPE_TABLE,
            ...event_implementor_type
        },
        event_link_change: {
            ...DEFAULT_COLUMN_NAMES_EVENT_LINK_CHANGE_TABLE,
            ...event_link_change
        },
        event_node_change: {
            ...DEFAULT_COLUMN_NAMES_EVENT_NODE_CHANGE_TABLE,
            ...event_node_change
        },
        event_node_fragment_register: {
            ...DEFAULT_COLUMN_NAMES_EVENT_NODE_FRAGMENT_REGISTER_TABLE,
            ...event_node_fragment_register
        },
        role: {
            ...DEFAULT_COLUMN_NAMES_ROLE_TABLE,
            ...role
        },
        user_role: {
            ...DEFAULT_COLUMN_NAMES_USER_ROLE_TABLE,
            ...user_role
        },
        node_snapshot: {
            ...DEFAULT_COLUMN_NAMES_SNAPSHOT_TABLE,
            ...node_snapshot
        }
    };
};

var EVENT_IMPLEMENTOR_TYPE_IDS;
(function (EVENT_IMPLEMENTOR_TYPE_IDS) {
    EVENT_IMPLEMENTOR_TYPE_IDS[EVENT_IMPLEMENTOR_TYPE_IDS["NODE_CHANGE"] = 1] = "NODE_CHANGE";
    EVENT_IMPLEMENTOR_TYPE_IDS[EVENT_IMPLEMENTOR_TYPE_IDS["NODE_FRAGMENT_CHANGE"] = 2] = "NODE_FRAGMENT_CHANGE";
    EVENT_IMPLEMENTOR_TYPE_IDS[EVENT_IMPLEMENTOR_TYPE_IDS["LINK_CHANGE"] = 3] = "LINK_CHANGE";
})(EVENT_IMPLEMENTOR_TYPE_IDS || (EVENT_IMPLEMENTOR_TYPE_IDS = {}));

/**
 * Create tables for storing versions of a node through time
 *
 * - A base table (`event`) describes the event interface.
 * - Two implementors of the interface exist: `event_link_change` and `event_node_change`
 * - The types of implementors that exist are in the `event_implementor_type` table
 * - `event_link_change` captures information about how edges of the node change
 * - `event_node_change` captures information about how the node's fields changes
 * - In some cases, a node is composed of other nodes. AKA: it is made up of node fragments.
 *     For this case, `event_node_change_fragment` captures information about the fragment nodes
 *     that make up the whole node
 * - Information about the user that caused an event is captured in the `event`, `user_role`, and `role` tables
 */
var createRevisionMigrations = (config) => {
    const { table_names, event, event_implementor_type, event_link_change, event_node_change, event_node_fragment_register, role, user_role, node_snapshot } = setNames(config);
    const up = async (knex) => {
        await knex.schema.createTable(table_names.event_implementor_type, t => {
            t.increments(event_implementor_type.id)
                .unsigned()
                .primary();
            t.string(event_implementor_type.type).notNullable();
        });
        await knex.schema.createTable(table_names.event, t => {
            t.increments(event.id)
                .unsigned()
                .primary();
            t.integer(event.implementor_type_id)
                .unsigned()
                .notNullable()
                .references(event_implementor_type.id)
                .inTable(table_names.event_implementor_type);
            t.timestamp(event.created_at).notNullable();
            t.string(event.user_id).notNullable();
            t.string(event.node_name).notNullable();
            t.string(event.node_id).notNullable();
            t.string(event.resolver_operation).notNullable();
        });
        await knex.schema.createTable(table_names.event_link_change, t => {
            t.increments(event_link_change.id)
                .unsigned()
                .primary();
            t.integer(event_link_change.event_id)
                .unsigned()
                .notNullable()
                .references(event.id)
                .inTable(table_names.event);
            t.string(event_link_change.node_name).notNullable();
            t.string(event_link_change.node_id).notNullable();
        });
        await knex.schema.createTable(table_names.event_node_change, t => {
            t.increments(event_node_change.id)
                .unsigned()
                .primary();
            t.integer(event_node_change.event_id)
                .unsigned()
                .notNullable()
                .references(event.id)
                .inTable(table_names.event);
            t.json(event_node_change.revision_data).notNullable();
            t.string(event_node_change.node_schema_version).notNullable();
        });
        await knex.schema.createTable(table_names.event_node_fragment_register, t => {
            t.increments(event_node_fragment_register.id)
                .unsigned()
                .primary();
            t.string(event_node_fragment_register.parent_node_id).notNullable();
            t.string(event_node_fragment_register.parent_node_name).notNullable();
            t.string(event_node_fragment_register.child_node_id).notNullable();
            t.string(event_node_fragment_register.child_node_name).notNullable();
        });
        await knex.schema.createTable(table_names.node_snapshot, t => {
            t.increments(node_snapshot.id)
                .unsigned()
                .primary();
            t.integer(node_snapshot.event_id)
                .unsigned()
                .notNullable()
                .references(event.id)
                .inTable(table_names.event);
            t.json(node_snapshot.snapshot).notNullable();
            t.string(event_node_change.node_schema_version).notNullable();
        });
        await knex.schema.createTable(table_names.role, t => {
            t.increments(role.id)
                .unsigned()
                .primary();
            t.string(role.role)
                .notNullable()
                .unique();
        });
        return await knex.schema.createTable(table_names.user_role, t => {
            t.increments(user_role.id)
                .unsigned()
                .primary();
            t.integer(user_role.event_id)
                .unsigned()
                .notNullable()
                .references(event.id)
                .inTable(table_names.event);
            t.integer(user_role.role_id)
                .unsigned()
                .notNullable()
                .references(role.id)
                .inTable(table_names.role);
        });
    };
    const down = async (knex) => {
        await knex.schema.dropTable(table_names.user_role);
        await knex.schema.dropTable(table_names.role);
        await knex.schema.dropTable(table_names.event_node_fragment_register);
        await knex.schema.dropTable(table_names.event_node_change);
        await knex.schema.dropTable(table_names.event_link_change);
        await knex.schema.dropTable(table_names.event);
        return await knex.schema.dropTable(table_names.event_implementor_type);
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
