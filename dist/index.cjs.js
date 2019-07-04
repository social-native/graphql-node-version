'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

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
    const target = typeof thing === 'function' ? thing.prototype : thing;
    for (let prop in decorators) {
        let propertyDecorators = decorators[prop];
        if (!Array.isArray(propertyDecorators)) {
            propertyDecorators = [propertyDecorators];
        }
        process.env.NODE_ENV !== 'production' &&
            invariant(propertyDecorators.every((decorator) => typeof decorator === 'function'), `Decorate: expected a decorator function or array of decorator functions for '${prop}'`);
        const descriptor = Object.getOwnPropertyDescriptor(target, prop);
        const newDescriptor = propertyDecorators.reduce((accDescriptor, decorator) => decorator(target, prop, accDescriptor), descriptor);
        if (newDescriptor)
            Object.defineProperty(target, prop, newDescriptor);
    }
    return thing;
}
//# sourceMappingURL=decorate.js.map

const setNames = ({ tableNames, columnNames }) => ({
    tableNames: {
        main: 'revisions',
        roles: 'roles',
        ...tableNames
    },
    columnNames: {
        userId: 'user_id',
        userRoles: 'user_roles',
        revisionData: 'revision',
        revisionTime: 'created_at',
        nodeVersion: 'node_version',
        nodeName: 'node_name',
        ...columnNames
    }
});
const createRevisionMigrations = (config) => {
    const { tableNames, columnNames } = setNames(config || {});
    const up = async (knex) => {
        return await knex.schema.createTable(tableNames.main, t => {
            t.increments('id')
                .unsigned()
                .primary();
            t.timestamp(columnNames.revisionTime).defaultTo(knex.fn.now());
            t.string(columnNames.userId);
            t.json(columnNames.revisionData);
            t.string(columnNames.nodeName);
            t.integer(columnNames.nodeVersion);
        });
    };
    const down = async (knex) => {
        return await knex.schema.dropTable(tableNames.main);
    };
    return { up, down };
};
const createRevisionTransaction = (config) => async (knex, input) => {
    const transaction = await knex.transaction();
    const { tableNames } = setNames(config || {});
    setTimeout(async () => {
        await transaction.rollback();
        throw new Error('Detected an orphaned transaction');
    }, ((config && config.transactionTimeoutSeconds) || 10) * 1000);
    knex(tableNames.main)
        .transacting(transaction)
        .insert(input);
    return { transaction };
};

exports.createRevisionMigrations = createRevisionMigrations;
exports.createRevisionTransaction = createRevisionTransaction;
exports.decorate = decorate;
