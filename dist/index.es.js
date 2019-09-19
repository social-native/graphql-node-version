import { ConnectionManager } from 'snpkg-snapi-connections';

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
    // revision table
    DEFAULT_COLUMN_NAMES["revisionId"] = "id";
    DEFAULT_COLUMN_NAMES["revisionTime"] = "revision_created_at";
    DEFAULT_COLUMN_NAMES["userId"] = "user_id";
    DEFAULT_COLUMN_NAMES["revisionData"] = "revision";
    DEFAULT_COLUMN_NAMES["nodeName"] = "node_name";
    DEFAULT_COLUMN_NAMES["nodeSchemaVersion"] = "node_schema_version";
    DEFAULT_COLUMN_NAMES["nodeId"] = "node_id";
    DEFAULT_COLUMN_NAMES["resolverName"] = "resolver_name";
    // revision node snapshot table
    DEFAULT_COLUMN_NAMES["snapshotId"] = "id";
    DEFAULT_COLUMN_NAMES["snapshotTime"] = "snapshot_created_at";
    DEFAULT_COLUMN_NAMES["snapshotData"] = "previous_node_version_snapshot";
    // revision role table
    DEFAULT_COLUMN_NAMES["roleId"] = "id";
    DEFAULT_COLUMN_NAMES["roleName"] = "role_name";
    // revision user roles
    DEFAULT_COLUMN_NAMES["userRoleId"] = "id";
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

var inverseObject = (obj) => {
    const keys = Object.keys(obj);
    return keys.reduce((inverseColumnNamesObj, nodeName) => {
        const sqlName = obj[nodeName];
        inverseColumnNamesObj[sqlName] = nodeName;
        return inverseColumnNamesObj;
    }, {});
};

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

// import {ConnectionManager, IInputArgs} from 'snpkg-snapi-connections';
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
            // Step 1. Get all versions for the connection
            const revisionsOfInterest = await getRevisionsOfInterest(ar, localKnexClient, nodeToSqlNameMappings, extractors);
            // Step 2. Get all the revisions + snapshots used to calculate the oldest revision in
            // the `revisionsOfInterest` array.
            console.log('REVISIONS IN RANGE', revisionsOfInterest);
            return node;
            // const precursorRevisions = await getPrecursorRevisions(
            //     revisionsOfInterest,
            //     ar,
            //     localKnexClient,
            //     nodeToSqlNameMappings,
            //     extractors
            // );
            // const versionEdges = revisionsInRange.reduce(
            //     (edges, version, index) => {
            //         let edge;
            //         if (index === 0) {
            //             edge = {
            //                 version,
            //                 node: extractors.nodeBuilder(node, version)
            //             };
            //         } else {
            //             const previousNode = edges[index - 1].node;
            //             edge = {
            //                 version,
            //                 node: extractors.nodeBuilder(previousNode, version)
            //             };
            //         }
            //         return [...edges, edge];
            //     },
            //     [] as Array<{node: typeof node; version: Unpacked<typeof revisionsInRange>}>
            // );
            // const versionEdgesObjByVersionId = versionEdges.reduce(
            //     (obj, edge) => {
            //         obj[edge.version.id] = edge;
            //         return obj;
            //     },
            //     {} as {[nodeId: string]: Unpacked<typeof versionEdges>}
            // );
            // const connectionOfInterest = await getRevisionsOfInterest(
            //     ar,
            //     localKnexClient,
            //     nodeToSqlNameMappings,
            //     extractors
            // );
            // const edgesOfInterest = connectionOfInterest.edges.map(edge => {
            //     return {
            //         ...edge,
            //         node: versionEdgesObjByVersionId[edge.node.id].node,
            //         version: edge.node
            //     };
            // });
            // return {...connectionOfInterest, edges: edgesOfInterest};
        });
        return descriptor;
    };
};
// const getPrecursorRevisions = async <ResolverT extends (...args: any[]) => any>(
//     revisionsInRange: [object],
//     inputArgs: ResolverArgs<ResolverT>,
//     knex: Knex,
//     nodeToSqlNameMappings: INamesForTablesAndColumns,
//     extractors: IVersionConnectionExtractors<ResolverT>
// ) => {};
// const getRevisionsInRange = async <ResolverT extends (...args: any[]) => any>(
//     inputArgs: ResolverArgs<ResolverT>,
//     knex: Knex,
//     nodeToSqlNameMappings: INamesForTablesAndColumns,
//     extractors: IVersionConnectionExtractors<ResolverT>
// ) => {
//     const {
//         id: idName,
//         nodeId: nodeIdName,
//         revisionData: revisionDataName,
//         snapshot: snapshotName,
//         revisionTime: revisionTimeName
//     } = nodeToSqlNameMappings.columnNames;
//     const attributeMap = {
//         id: idName,
//         nodeId: nodeIdName,
//         revisionData: revisionDataName,
//         snapshot: snapshotName,
//         revisionTime: `${nodeToSqlNameMappings.tableNames.revision}.${revisionTimeName}`
//     };
//     const {id, ...selectableAttributes} = attributeMap;
//     const connectionArgs = {orderBy: 'id', orderDir: 'asc'} as IInputArgs;
//     const nodeConnection = new ConnectionManager<typeof attributeMap>(connectionArgs, attributeMap);
//     const nodeId = extractors.nodeId ? extractors.nodeId(...inputArgs) : inputArgs.id;
//     const queryBuilder = knex
//         .queryBuilder()
//         .table(nodeToSqlNameMappings.tableNames.revision)
//         .leftJoin(
//             nodeToSqlNameMappings.tableNames.revisionNodeSnapshot,
//             `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.tableNames.revision}_id`, // tslint:disable-line
//             `${nodeToSqlNameMappings.tableNames.revision}.id`
//         )
//         .where({[nodeToSqlNameMappings.columnNames.nodeId]: nodeId})
//         .select([
//             `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.id}`,
//             ...Object.values(selectableAttributes)
//         ]);
//     const result = await nodeConnection.createQuery(queryBuilder);
//     nodeConnection.addResult(result);
//     return nodeConnection.edges.map(({node}) => node);
// };
const getRevisionsOfInterest = async (inputArgs, knex, nodeToSqlNameMappings, extractors) => {
    // const {
    //     id: idName,
    //     nodeId: nodeIdName,
    //     revisionData: revisionDataName,
    //     snapshot: snapshotName,
    //     revisionTime: revisionTimeName
    // } = nodeToSqlNameMappings.columnNames;
    const attributeMap = {
        ...nodeToSqlNameMappings.columnNames,
        id: `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
        revisionTime: `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionTime}`
        // nodeId: `${nodeToSqlNameMappings.tableNames.revision}.${nodeIdName}`,
        // revisionData: revisionDataName,
        // snapshot: snapshotName,
        // revisionTime: `${nodeToSqlNameMappings.tableNames.revision}.${revisionTimeName}`
    };
    // const attributeMap = nodeToSqlNameMappings.columnNames;
    // force orderDir to be 'desc' b/c last is most recent in versions
    // const newInputArgs = {...inputArgs, orderDir: 'desc'};
    const nodeConnection = new ConnectionManager(inputArgs, attributeMap);
    const nodeId = extractors.nodeId ? extractors.nodeId(...inputArgs) : inputArgs.id;
    // const {id, snapshot, revisionTime, ...selectableAttributes} = attributeMap;
    const query = knex
        .queryBuilder()
        .from(function () {
        // const {roleName, snapshot: unusedSnapshot, ...attributes} = attributeMap;
        const queryBuilder = this.table(nodeToSqlNameMappings.tableNames.revision)
            .leftJoin(nodeToSqlNameMappings.tableNames.revisionNodeSnapshot, `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.tableNames.revision}_${nodeToSqlNameMappings.columnNames.revisionId}`, // tslint:disable-line
        `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`)
            .where({
            [`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeId}`]: nodeId
        })
            .select(`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId} as revision_id`, // tslint:disable-line
        `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionTime} as revision_created_at`, // tslint:disable-line
        `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionData} as revision_data`, // tslint:disable-line
        `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeName} as node_name`, // tslint:disable-line
        `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeSchemaVersion} as node_schema_version`, // tslint:disable-line
        `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeId} as node_id`, // tslint:disable-line
        `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.resolverName} as resolver_name`, // tslint:disable-line
        `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.userId} as user_id`, // tslint:disable-line
        `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.columnNames.snapshotData} as snapshot`, // tslint:disable-line
        `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.columnNames.revisionTime} as snapshot_created_at` // tslint:disable-line
        );
        nodeConnection.createQuery(queryBuilder).as('main');
    })
        .leftJoin(nodeToSqlNameMappings.tableNames.revisionUserRole, `${nodeToSqlNameMappings.tableNames.revisionUserRole}.${nodeToSqlNameMappings.tableNames.revision}_id`, `main.revision_id`)
        .leftJoin(nodeToSqlNameMappings.tableNames.revisionRole, `${nodeToSqlNameMappings.tableNames.revisionUserRole}.${nodeToSqlNameMappings.tableNames.revisionRole}_id`, `${nodeToSqlNameMappings.tableNames.revisionRole}.id`);
    // .select([
    //     `main.${nodeToSqlNameMappings.columnNames.id}`,
    //     ...Object.values(selectableAttributes)
    // ]);
    const result = await query;
    console.log('RAW RESULT', result);
    const nodeResult = result.map(r => sqlToNode(nodeToSqlNameMappings, r));
    console.log('NODE RESULT', nodeResult);
    const uniqueVersions = aggregateVersionsById(nodeResult);
    console.log('UNIQUE VERSIONS', uniqueVersions);
    nodeConnection.addResult(uniqueVersions);
    const { pageInfo, edges } = nodeConnection;
    return { pageInfo, edges };
};
/**
 * B/c user roles are 1:many with a revision we have duplicates of revisions
 * for each user role. Thus, we need to combine user roles together into an array for
 * each duplicate of a revision.
 */
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
            const nodeSchemaVersion = extractors.nodeSchemaVersion(...args);
            const nodeName = extractors.nodeName(...args);
            const snapshotFrequency = extractors.currentNodeSnapshotFrequency
                ? extractors.currentNodeSnapshotFrequency
                : 1;
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
                nodeSchemaVersion,
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
                if (nodeId === undefined) {
                    throw new Error(`Unable to extract node id in version recorder for node ${nodeName}`);
                }
                await localKnexClient
                    .table(tableNames.revision)
                    .update({ [columnNames.nodeId]: nodeId })
                    .where({ id: revisionId });
            }
            const shouldStoreSnapshot = await findIfShouldStoreSnapshot({ tableNames, columnNames }, snapshotFrequency, localKnexClient, nodeId, nodeName, nodeSchemaVersion);
            if (shouldStoreSnapshot) {
                // console.log('THESE ARGS', args);
                const currentNodeSnapshot = await extractors.currentNodeSnapshot(nodeId, args);
                // (
                //     ...(args as Parameters<ResolverT>)
                // );
                await storeCurrentNodeSnapshot({ tableNames, columnNames }, currentNodeSnapshot, revisionId, localKnexClient);
            }
            return node;
        });
        return descriptor;
    };
};
/**
 * Write the node snapshot to the database
 */
const storeCurrentNodeSnapshot = async ({ tableNames, columnNames }, currentNodeSnapshot, revisionId, localKnexClient) => {
    await localKnexClient.table(tableNames.revisionNodeSnapshot).insert({
        [`${tableNames.revision}_${columnNames.revisionId}`]: revisionId,
        [columnNames.snapshotData]: JSON.stringify(currentNodeSnapshot) // tslint:disable-line
    });
};
/**
 * Fetch the number of full node snapshots for the node id and node schema version
 * If a snapshot exists within the expected snapshot frequency, then we don't need to take another snapshot
 */
const findIfShouldStoreSnapshot = async ({ tableNames, columnNames }, snapshotFrequency, localKnexClient, nodeId, nodeName, mostRecentNodeSchemaVersion) => {
    const sql = localKnexClient
        .table(tableNames.revision)
        .leftJoin(tableNames.revisionNodeSnapshot, `${tableNames.revision}.${columnNames.revisionId}`, `${tableNames.revisionNodeSnapshot}.${tableNames.revision}_${columnNames.revisionId}`)
        .where({
        [`${tableNames.revision}.${columnNames.nodeName}`]: nodeName,
        [`${tableNames.revision}.${columnNames.nodeId}`]: nodeId,
        [`${tableNames.revision}.${columnNames.nodeSchemaVersion}`]: mostRecentNodeSchemaVersion
    })
        .orderBy(`${tableNames.revision}.${columnNames.revisionTime}`, 'desc')
        .limit(snapshotFrequency)
        .select(`${tableNames.revision}.${columnNames.revisionTime} as revision_creation`, `${tableNames.revisionNodeSnapshot}.${columnNames.revisionTime} as snapshot_creation`);
    const snapshots = (await sql);
    const snapshotWithinFrequencyRange = !!snapshots.find(data => data.snapshot_creation);
    return !snapshotWithinFrequencyRange;
};

var generator = (config) => {
    const { tableNames, columnNames } = setNames(config || {});
    const up = async (knex) => {
        const revision = await knex.schema.createTable(tableNames.revision, t => {
            t.increments(columnNames.revisionId)
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
            t.increments(columnNames.snapshotId)
                .unsigned()
                .primary();
            t.timestamp(columnNames.snapshotTime).defaultTo(knex.fn.now());
            t.integer(`${tableNames.revision}_${columnNames.revisionId}`)
                .unsigned()
                .notNullable()
                .references(columnNames.revisionId)
                .inTable(tableNames.revision);
            t.json(columnNames.snapshotData);
        });
        if (tableNames.revisionRole && tableNames.revisionUserRole) {
            await knex.schema.createTable(tableNames.revisionRole, t => {
                t.increments(columnNames.roleId)
                    .unsigned()
                    .primary();
                t.string(columnNames.roleName)
                    .notNullable()
                    .unique();
            });
            return await knex.schema.createTable(tableNames.revisionUserRole, t => {
                t.increments(columnNames.userRoleId)
                    .unsigned()
                    .primary();
                t.integer(`${tableNames.revision}_${columnNames.revisionId}`)
                    .unsigned()
                    .notNullable()
                    .references(columnNames.revisionId)
                    .inTable(tableNames.revision);
                t.integer(`${tableNames.revisionRole}_${columnNames.roleId}`)
                    .unsigned()
                    .notNullable()
                    .references(columnNames.roleId)
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

export { generator as createRevisionMigrations, decorate, versionConnection as versionConnectionDecorator, versionRecorder as versionRecorderDecorator };
