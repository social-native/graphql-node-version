const path = require('path');
const tildify = require('tildify');
const color = require('colorette');
const argv = require('getopts')(process.argv.slice(2));

const {mkConfigObj, resolveKnexFilePath} = require('./cli-config-utils');
const {DEFAULT_EXT} = require('./constants');

function exit(text) {
    if (text instanceof Error) {
        console.error(color.red(`${text.detail ? `${text.detail}\n` : ''}${text.stack}`));
    } else {
        console.error(color.red(text));
    }
    process.exit(1);
}

function success(text) {
    console.log(text);
    process.exit(0);
}

function checkLocalModule(env) {
    if (!env.modulePath) {
        console.log(color.red('No local knex install found in:'), color.magenta(tildify(env.cwd)));
        exit('Try running: npm install knex');
    }
}

function getMigrationExtension(env, opts) {
    const config = resolveEnvironmentConfig(opts, env.configuration);

    let ext = DEFAULT_EXT;
    if (argv.x) {
        ext = argv.x;
    } else if (config.migrations && config.migrations.extension) {
        ext = config.migrations.extension;
    } else if (config.ext) {
        ext = config.ext;
    }
    return ext.toLowerCase();
}

function initKnex(env, opts) {
    checkLocalModule(env);
    if (process.cwd() !== env.cwd) {
        process.chdir(env.cwd);
        console.log('Working directory changed to', color.magenta(tildify(env.cwd)));
    }

    if (!opts.knexfile) {
        const configurationPath = resolveKnexFilePath();
        const configuration = configurationPath ? require(configurationPath.path) : undefined;

        env.configuration = configuration || mkConfigObj(opts);
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
        console.log('Using environment:', color.magenta(environment));
    }

    if (!result) {
        console.log(color.red('Warning: unable to read knexfile config'));
        process.exit(1);
    }

    if (argv.debug !== undefined) {
        result.debug = argv.debug;
    }

    return result;
}

module.exports = {
    initKnex,
};