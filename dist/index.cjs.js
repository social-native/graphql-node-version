'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var versionConnection = (extractors
// config?: ICreateRevisionTransactionConfig & INamesConfig
) => {
    return (_target, _property, descriptor) => {
        // const {tableNames, columnNames} = setNames(config || {});
        const { value } = descriptor;
        if (typeof value !== 'function') {
            throw new TypeError('Only functions can be decorated.');
        }
        // if (!extractors.nodeIdCreate && !extractors.nodeIdUpdate) {
        //     throw new Error(
        //         // tslint:disable-next-line
        //         'No node id extractor specified in the config. You need to specify either a `nodeIdUpdate` or `nodeIdCreate` extractor'
        //     );
        // }
        // tslint:disable-next-line
        descriptor.value = (async (...args) => {
            const localKnexClient = extractors.knex && extractors.knex(...args);
            console.log(localKnexClient);
            // const userId =
            //     extractors.userId && extractors.userId(...(args as Parameters<ResolverT>));
            // const userRoles = extractors.userRoles
            //     ? extractors.userRoles(...(args as Parameters<ResolverT>))
            //     : [];
            // const revisionData =
            //     extractors.revisionData &&
            //     extractors.revisionData(...(args as Parameters<ResolverT>));
            // const revisionTime = extractors.revisionTime
            //     ? extractors.revisionTime(...(args as Parameters<ResolverT>))
            //     : new Date()
            //           .toISOString()
            //           .split('Z')
            //           .join('');
            // const nodeVersion =
            //     extractors.nodeVersion &&
            //     extractors.nodeVersion(...(args as Parameters<ResolverT>));
            // const nodeName = extractors.nodeName
            //     ? extractors.nodeName(...(args as Parameters<ResolverT>))
            //     : property;
            // let nodeId = extractors.nodeIdUpdate
            //     ? extractors.nodeIdUpdate(...(args as Parameters<ResolverT>))
            //     : undefined;
            // const revisionInput = {
            //     userId,
            //     userRoles,
            //     revisionData,
            //     revisionTime,
            //     nodeVersion,
            //     nodeName: typeof nodeName === 'symbol' ? nodeName.toString() : nodeName,
            //     nodeId
            // };
            // const revTxFn = createRevisionTransaction(config);
            // const {transaction, revisionId} = await revTxFn(localKnexClient, revisionInput);
            const [parent, ar, ctx, info] = args;
            // const newArgs = {...ar, transaction};
            const node = (await value(parent, ar, ctx, info));
            // if (!nodeId) {
            //     nodeId = extractors.nodeIdCreate ? extractors.nodeIdCreate(node) : undefined;
            //     await localKnexClient
            //         .table(tableNames.revision)
            //         .update({[columnNames.nodeId]: nodeId})
            //         .where({id: revisionId});
            // }
            return node;
        });
        return descriptor;
    };
};

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
})(DEFAULT_TABLE_NAMES || (DEFAULT_TABLE_NAMES = {}));
var DEFAULT_COLUMN_NAMES;
(function (DEFAULT_COLUMN_NAMES) {
    DEFAULT_COLUMN_NAMES["userId"] = "user_id";
    DEFAULT_COLUMN_NAMES["userRoles"] = "user_roles";
    DEFAULT_COLUMN_NAMES["revisionData"] = "revision";
    DEFAULT_COLUMN_NAMES["revisionTime"] = "created_at";
    DEFAULT_COLUMN_NAMES["nodeVersion"] = "node_version";
    DEFAULT_COLUMN_NAMES["nodeName"] = "node_name";
    DEFAULT_COLUMN_NAMES["nodeId"] = "node_id";
    DEFAULT_COLUMN_NAMES["roleName"] = "role_name";
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

const transformInput = ({ columnNames, columnData }) => {
    return Object.keys(columnNames || {}).reduce((newColumnDataObj, columnName) => {
        const newColumnName = columnNames[columnName];
        const data = columnData[columnName];
        if (data) {
            newColumnDataObj[newColumnName] = data;
        }
        return newColumnDataObj;
    }, {});
};
const createRevisionTransaction = (config) => async (knex, input) => {
    const { tableNames, columnNames } = setNames(config || {});
    const { userRoles, ...mainTableInput } = input;
    const transformedMainTableInput = transformInput({ columnNames, columnData: mainTableInput });
    const transaction = await knex.transaction();
    const revisionId = (await transaction
        .table(tableNames.revision)
        .insert(transformedMainTableInput)
        .returning('id'))[0];
    const roles = userRoles || [];
    // calculate which role are missing in the db
    const foundRoleNames = await transaction
        .table(tableNames.revisionRole)
        .whereIn(columnNames.roleName, roles);
    const foundRoles = foundRoleNames.map((n) => n[columnNames.roleName]);
    const missingRoles = roles.filter(i => foundRoles.indexOf(i) < 0);
    // insert the missing roles
    await transaction
        .table(tableNames.revisionRole)
        .insert(missingRoles.map((role) => ({ [columnNames.roleName]: role })));
    // select the role ids
    const ids = (await transaction
        .table(tableNames.revisionRole)
        .whereIn(columnNames.roleName, roles));
    // insert roles ids associated with the revision id
    await transaction.table(tableNames.revisionUserRole).insert(ids.map(({ id }) => ({
        [`${tableNames.revisionRole}_id`]: id,
        [`${tableNames.revision}_id`]: revisionId
    })));
    setTimeout(async () => {
        await transaction.rollback();
        // throw new Error('Detected an orphaned transaction');
    }, ((config && config.transactionTimeoutSeconds) || 10) * 1000);
    return { transaction, revisionId };
};
var versionRecorder = (extractors, config) => {
    return (_target, property, descriptor) => {
        const { tableNames, columnNames } = setNames(config || {});
        const { value } = descriptor;
        if (typeof value !== 'function') {
            throw new TypeError('Only functions can be decorated.');
        }
        if (!extractors.nodeIdCreate && !extractors.nodeIdUpdate) {
            throw new Error(
            // tslint:disable-next-line
            'No node id extractor specified in the config. You need to specify either a `nodeIdUpdate` or `nodeIdCreate` extractor');
        }
        // tslint:disable-next-line
        descriptor.value = (async (...args) => {
            const localKnexClient = extractors.knex && extractors.knex(...args);
            const userId = extractors.userId && extractors.userId(...args);
            const userRoles = extractors.userRoles
                ? extractors.userRoles(...args)
                : [];
            const revisionData = extractors.revisionData &&
                extractors.revisionData(...args);
            const revisionTime = extractors.revisionTime
                ? extractors.revisionTime(...args)
                : new Date()
                    .toISOString()
                    .split('Z')
                    .join('');
            const nodeVersion = extractors.nodeVersion &&
                extractors.nodeVersion(...args);
            const nodeName = extractors.nodeName
                ? extractors.nodeName(...args)
                : property;
            let nodeId = extractors.nodeIdUpdate
                ? extractors.nodeIdUpdate(...args)
                : undefined;
            const revisionInput = {
                userId,
                userRoles,
                revisionData,
                revisionTime,
                nodeVersion,
                nodeName: typeof nodeName === 'symbol' ? nodeName.toString() : nodeName,
                nodeId
            };
            const revTxFn = createRevisionTransaction(config);
            const { transaction, revisionId } = await revTxFn(localKnexClient, revisionInput);
            const [parent, ar, ctx, info] = args;
            const newArgs = { ...ar, transaction };
            const node = (await value(parent, newArgs, ctx, info));
            if (!nodeId) {
                nodeId = extractors.nodeIdCreate ? extractors.nodeIdCreate(node) : undefined;
                await localKnexClient
                    .table(tableNames.revision)
                    .update({ [columnNames.nodeId]: nodeId })
                    .where({ id: revisionId });
            }
            return node;
        });
        return descriptor;
    };
};

var generator = (config) => {
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
            t.integer(columnNames.nodeVersion);
            t.integer(columnNames.nodeId);
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
        return await knex.schema.dropTable(tableNames.revision);
    };
    return { up, down };
};

// tslint:disable
/**
 * **************************************************************
 * https://github.com/mobxjs/mobx/blob/master/src/utils/utils.ts
 * **************************************************************
 */
const OBFUSCATED_ERROR = 'An invariant failed, however the error is obfuscated because this is an production build.';
function invariant(check, message) {
    if (!check) {
        throw new Error('[decorate] ' + (message || OBFUSCATED_ERROR));
    }
}
function isPlainObject(value) {
    if (value === null || typeof value !== 'object') {
        return false;
    }
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}
function decorate(thing, decorators) {
    process.env.NODE_ENV !== 'production' &&
        invariant(isPlainObject(decorators), 'Decorators should be a key value map');
    const target = (typeof thing === 'function' ? thing.prototype : thing);
    for (let prop in decorators) {
        let propertyDecorators;
        const extractedDecorators = decorators[prop];
        if (!isDecoratorArray(extractedDecorators)) {
            propertyDecorators = [extractedDecorators];
        }
        else {
            propertyDecorators = extractedDecorators;
        }
        process.env.NODE_ENV !== 'production' &&
            invariant(propertyDecorators.every(decorator => typeof decorator === 'function'), `Decorate: expected a decorator function or array of decorator functions for '${prop}'`);
        const descriptor = Object.getOwnPropertyDescriptor(target, prop);
        if (!descriptor) {
            invariant(descriptor, 'Could not find descriptor on object');
            break;
        }
        const newDescriptor = [...propertyDecorators].reduce((accDescriptor, decorator) => decorator(target, prop, accDescriptor), descriptor);
        if (newDescriptor) {
            Object.defineProperty(target, prop, newDescriptor);
        }
    }
    return thing;
}
// tslint:enable
function isDecoratorArray(decorator) {
    return decorator !== undefined && Array.isArray(decorator);
}

exports.createRevisionMigrations = generator;
exports.decorate = decorate;
exports.versionConnectionDecorator = versionConnection;
exports.versionRecorderDecorator = versionRecorder;
