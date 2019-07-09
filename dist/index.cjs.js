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
//# sourceMappingURL=decorate.js.map

const DEFAULT_TABLE_NAMES = {
    main: 'revisions',
    roles: 'roles'
};
const DEFAULT_COLUMN_NAMES = {
    userId: 'user_id',
    userRoles: 'user_roles',
    revisionData: 'revision',
    revisionTime: 'created_at',
    nodeVersion: 'node_version',
    nodeName: 'node_name'
};
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
    const { tableNames, columnNames } = setNames(config || {});
    const { userRoles, ...mainTableInput } = input;
    const transformedMainTableInput = transformInput({ columnNames, columnData: mainTableInput });
    const transaction = await knex.transaction();
    await transaction.table(tableNames.main).insert(transformedMainTableInput);
    setTimeout(async () => {
        await transaction.rollback();
        // throw new Error('Detected an orphaned transaction');
    }, ((config && config.transactionTimeoutSeconds) || 10) * 1000);
    return { transaction };
};
const versionedTransactionDecorator = (extractors, revisionTx) => {
    return (_target, property, descriptor) => {
        const { value } = descriptor;
        if (typeof value !== 'function') {
            throw new TypeError('Only functions can be decorated.');
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
            const revisionInput = {
                userId,
                userRoles,
                revisionData,
                revisionTime,
                nodeVersion,
                nodeName: typeof nodeName === 'symbol' ? nodeName.toString() : nodeName
            };
            const revTxFn = revisionTx ? revisionTx : createRevisionTransaction();
            const { transaction } = await revTxFn(localKnexClient, revisionInput);
            const [parent, ar, ctx, info] = args;
            const newArgs = { ...ar, transaction };
            return (await value(parent, newArgs, ctx, info));
        });
        return descriptor;
    };
};
//# sourceMappingURL=index.js.map

exports.createRevisionMigrations = createRevisionMigrations;
exports.createRevisionTransaction = createRevisionTransaction;
exports.decorate = decorate;
exports.versionedTransactionDecorator = versionedTransactionDecorator;
