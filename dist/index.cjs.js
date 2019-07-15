'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var snpkgSnapiConnections = require('snpkg-snapi-connections');

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
    DEFAULT_COLUMN_NAMES["nodeVersion"] = "node_version";
    DEFAULT_COLUMN_NAMES["nodeName"] = "node_name";
    DEFAULT_COLUMN_NAMES["nodeId"] = "node_id";
    DEFAULT_COLUMN_NAMES["roleName"] = "role_name";
    DEFAULT_COLUMN_NAMES["resolverName"] = "resolver_name";
    DEFAULT_COLUMN_NAMES["snapshot"] = "snapshot";
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
//# sourceMappingURL=sqlNames.js.map

var inverseObject = (obj) => {
    const keys = Object.keys(obj);
    return keys.reduce((inverseColumnNamesObj, nodeName) => {
        const sqlName = obj[nodeName];
        inverseColumnNamesObj[sqlName] = nodeName;
        return inverseColumnNamesObj;
    }, {});
};
//# sourceMappingURL=inverseObject.js.map

var sqlToNode = (nodeToSqlNameMappings, sqlData) => {
    const { columnNames } = nodeToSqlNameMappings;
    const sqlToNodeNameMappings = inverseObject(columnNames);
    return Object.keys(sqlToNodeNameMappings).reduce((nodeData, sqlName) => {
        const nodeName = sqlToNodeNameMappings[sqlName];
        const data = sqlData[sqlName];
        if (data) {
            nodeData[nodeName] = data;
        }
        return nodeData;
    }, {});
};
//# sourceMappingURL=sqlToNode.js.map

var versionConnection = (extractors, config) => {
    return (_target, _property, descriptor) => {
        const nodeToSqlNameMappings = setNames(config || {});
        const { value } = descriptor;
        if (typeof value !== 'function') {
            throw new TypeError('Only functions can be decorated.');
        }
        // tslint:disable-next-line
        descriptor.value = (async (...args) => {
            const localKnexClient = extractors.knex && extractors.knex(...args);
            const [parent, ar, ctx, info] = args;
            const node = (await value(parent, ar, ctx, info));
            // --------------
            const nodeId = extractors.nodeId ? extractors.nodeId(...ar) : ar.id;
            const { id: latestId, snapshot: latestSnapshot } = await localKnexClient
                .queryBuilder()
                .table(nodeToSqlNameMappings.tableNames.revision)
                .leftJoin(nodeToSqlNameMappings.tableNames.revisionNodeSnapshot, `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.tableNames.revision}_id`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revision}.id`)
                .where({ [nodeToSqlNameMappings.columnNames.nodeId]: nodeId })
                .orderBy(`${nodeToSqlNameMappings.tableNames.revision}.id`, 'desc')
                .first()
                .select(`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.id}`, `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.columnNames.snapshot}` // tslint:disable-line
            );
            if (!latestSnapshot) {
                await localKnexClient
                    .table(nodeToSqlNameMappings.tableNames.revisionNodeSnapshot)
                    .insert({
                    [`${nodeToSqlNameMappings.tableNames.revision}_id`]: latestId,
                    [nodeToSqlNameMappings.columnNames.snapshot]: JSON.stringify(node) // tslint:disable-line
                });
            }
            console.log('LATEST SNAPSHOT', latestSnapshot);
            // --------------
            const revisionsInRange = await getRevisionsInRange(ar, localKnexClient, nodeToSqlNameMappings, extractors);
            const versionEdges = revisionsInRange.reduce((edges, version, index) => {
                let edge;
                if (index === 0) {
                    edge = {
                        version,
                        node: extractors.nodeBuilder(node, version)
                    };
                }
                else {
                    const previousNode = edges[index - 1].node;
                    edge = {
                        version,
                        node: extractors.nodeBuilder(previousNode, version)
                    };
                }
                return [...edges, edge];
            }, []);
            const versionEdgesObjByVersionId = versionEdges.reduce((obj, edge) => {
                obj[edge.version.id] = edge;
                return obj;
            }, {});
            const connectionOfInterest = await getRevisionsOfInterest(ar, localKnexClient, nodeToSqlNameMappings, extractors);
            const edgesOfInterest = connectionOfInterest.edges.map(edge => {
                return {
                    ...edge,
                    node: versionEdgesObjByVersionId[edge.node.id].node,
                    version: edge.node
                };
            });
            return { ...connectionOfInterest, edges: edgesOfInterest };
        });
        return descriptor;
    };
};
const getRevisionsInRange = async (inputArgs, knex, nodeToSqlNameMappings, extractors) => {
    const { id: idName, nodeId: nodeIdName, revisionData: revisionDataName } = nodeToSqlNameMappings.columnNames;
    const attributeMap = { id: idName, nodeId: nodeIdName, revisionData: revisionDataName };
    const connectionArgs = { orderBy: 'id', orderDir: 'asc' };
    const nodeConnection = new snpkgSnapiConnections.ConnectionManager(connectionArgs, attributeMap);
    const nodeId = extractors.nodeId ? extractors.nodeId(...inputArgs) : inputArgs.id;
    const queryBuilder = knex
        .queryBuilder()
        .table(nodeToSqlNameMappings.tableNames.revision)
        .where({ [nodeToSqlNameMappings.columnNames.nodeId]: nodeId })
        .select(attributeMap);
    const result = await nodeConnection.createQuery(queryBuilder);
    nodeConnection.addResult(result);
    return nodeConnection.edges.map(({ node }) => node);
};
const getRevisionsOfInterest = async (inputArgs, knex, nodeToSqlNameMappings, extractors) => {
    const attributeMap = nodeToSqlNameMappings.columnNames;
    // force orderDir to be 'desc' b/c last is most recent in versions
    // const newInputArgs = {...inputArgs, orderDir: 'desc'};
    const nodeConnection = new snpkgSnapiConnections.ConnectionManager(inputArgs, attributeMap);
    const nodeId = extractors.nodeId ? extractors.nodeId(...inputArgs) : inputArgs.id;
    const { id, snapshot, ...selectableAttributes } = attributeMap;
    const query = knex
        .queryBuilder()
        .from(function () {
        const { roleName, snapshot: unusedSnapshot, ...attributes } = attributeMap;
        const queryBuilder = this.table(nodeToSqlNameMappings.tableNames.revision)
            .where({
            [nodeToSqlNameMappings.columnNames.nodeId]: nodeId
        })
            .select(Object.values(attributes));
        nodeConnection.createQuery(queryBuilder).as('main');
    })
        .leftJoin(nodeToSqlNameMappings.tableNames.revisionUserRole, `${nodeToSqlNameMappings.tableNames.revisionUserRole}.${nodeToSqlNameMappings.tableNames.revision}_id`, `main.${nodeToSqlNameMappings.columnNames.id}`)
        .leftJoin(nodeToSqlNameMappings.tableNames.revisionRole, `${nodeToSqlNameMappings.tableNames.revisionUserRole}.${nodeToSqlNameMappings.tableNames.revisionRole}_id`, `${nodeToSqlNameMappings.tableNames.revisionRole}.id`)
        .select([
        `main.${nodeToSqlNameMappings.columnNames.id}`,
        ...Object.values(selectableAttributes)
    ]);
    const result = await query;
    const nodeResult = result.map(r => sqlToNode(nodeToSqlNameMappings, r));
    const uniqueVersions = aggregateVersionsById(nodeResult);
    nodeConnection.addResult(uniqueVersions);
    const { pageInfo, edges } = nodeConnection;
    return { pageInfo, edges };
};
const aggregateVersionsById = (nodeVersions) => {
    // extract all the user roles for the version
    const rolesByRevisionId = nodeVersions.reduce((rolesObj, { id, roleName }) => {
        const roleNames = rolesObj[id] || [];
        rolesObj[id] = roleNames.includes(roleName) ? roleNames : [...roleNames, roleName];
        return rolesObj;
    }, {});
    // map over the versions
    // - aggregate by version id
    // - serialize revision data to json if its not already
    // - add user roles
    const versions = nodeVersions.reduce((uniqueVersions, version) => {
        if (uniqueVersions[version.id]) {
            return uniqueVersions;
        }
        uniqueVersions[version.id] = {
            ...version,
            userRoles: rolesByRevisionId[version.id],
            revisionData: typeof version.revisionData === 'string'
                ? version.revisionData
                : JSON.stringify(version.revisionData)
        };
        return uniqueVersions;
    }, {});
    // make sure versions are returned in the same order as they came in
    return [...new Set(nodeVersions.map(({ id }) => id))].map(id => versions[id]);
};
//# sourceMappingURL=versionConnection.js.map

var nodeToSql = (nodeToSqlNameMappings, nodeData) => {
    const { columnNames } = nodeToSqlNameMappings;
    const nodeNames = Object.keys(columnNames);
    return nodeNames.reduce((sqlData, nodeName) => {
        const sqlName = columnNames[nodeName];
        const data = nodeData[nodeName];
        if (data) {
            sqlData[sqlName] = data;
        }
        return sqlData;
    }, {});
};
//# sourceMappingURL=nodeToSql.js.map

const createRevisionTransaction = (config) => async (knex, input) => {
    const nodeToSqlNameMappings = setNames(config || {});
    const { userRoles, ...mainTableInput } = input;
    const sqlData = nodeToSql(nodeToSqlNameMappings, mainTableInput);
    const transaction = await knex.transaction();
    const revisionId = (await transaction
        .table(nodeToSqlNameMappings.tableNames.revision)
        .insert(sqlData)
        .returning('id'))[0];
    const roles = userRoles || [];
    // calculate which role are missing in the db
    const foundRoleNames = await transaction
        .table(nodeToSqlNameMappings.tableNames.revisionRole)
        .whereIn(nodeToSqlNameMappings.columnNames.roleName, roles);
    const foundRoles = foundRoleNames.map((n) => n[nodeToSqlNameMappings.columnNames.roleName]);
    const missingRoles = roles.filter(i => foundRoles.indexOf(i) < 0);
    // insert the missing roles
    await transaction.table(nodeToSqlNameMappings.tableNames.revisionRole).insert(missingRoles.map((role) => ({
        [nodeToSqlNameMappings.columnNames.roleName]: role
    })));
    // select the role ids
    const ids = (await transaction
        .table(nodeToSqlNameMappings.tableNames.revisionRole)
        .whereIn(nodeToSqlNameMappings.columnNames.roleName, roles));
    // insert roles ids associated with the revision id
    await transaction.table(nodeToSqlNameMappings.tableNames.revisionUserRole).insert(ids.map(({ id }) => ({
        [`${nodeToSqlNameMappings.tableNames.revisionRole}_id`]: id,
        [`${nodeToSqlNameMappings.tableNames.revision}_id`]: revisionId
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
            const localKnexClient = extractors.knex(...args);
            const userId = extractors.userId(...args);
            const revisionData = extractors.revisionData(...args);
            const nodeVersion = extractors.nodeVersion(...args);
            const nodeName = extractors.nodeName(...args);
            const userRoles = extractors.userRoles
                ? extractors.userRoles(...args)
                : [];
            const revisionTime = extractors.revisionTime
                ? extractors.revisionTime(...args)
                : new Date()
                    .toISOString()
                    .split('Z')
                    .join('');
            let nodeId = extractors.nodeIdUpdate
                ? extractors.nodeIdUpdate(...args)
                : undefined;
            const resolverName = extractors.resolverName
                ? extractors.resolverName(...args)
                : property;
            const revisionInput = {
                userId,
                userRoles,
                revisionData,
                revisionTime,
                nodeVersion,
                nodeName,
                nodeId,
                resolverName: typeof resolverName === 'symbol' ? resolverName.toString() : resolverName
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
//# sourceMappingURL=versionRecorder.js.map

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
            t.string(columnNames.resolverName);
        });
        await knex.schema.createTable(tableNames.revisionNodeSnapshot, t => {
            t.increments('id')
                .unsigned()
                .primary();
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
//# sourceMappingURL=generator.js.map

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

exports.createRevisionMigrations = generator;
exports.decorate = decorate;
exports.versionConnectionDecorator = versionConnection;
exports.versionRecorderDecorator = versionRecorder;
