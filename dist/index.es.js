import { getSqlDialectTranslator } from '@social-native/snpkg-snapi-ndm';
import Bluebird from 'bluebird';

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

var eventInfoBaseExtractor = (args, extractors, resolverOperation, nodeId) => {
    const userId = extractors.userId(args[0], args[1], args[2], args[3]);
    const nodeName = extractors.nodeName;
    const userRoles = extractors.userRoles
        ? extractors.userRoles(args[0], args[1], args[2], args[3])
        : [];
    const createdAt = extractors.eventTime
        ? extractors.eventTime(args[0], args[1], args[2], args[3])
        : // TODO check this
            new Date()
                .toISOString()
                .split('Z')
                .join('');
    const snapshotFrequency = extractors.currentNodeSnapshotFrequency
        ? extractors.currentNodeSnapshotFrequency
        : 1;
    return {
        createdAt,
        userId,
        nodeName,
        nodeId,
        resolverOperation,
        userRoles,
        snapshotFrequency
    };
};

var eventLinkChangeInfoExtractor = (args, extractors, eventInfoBase) => {
    const edgesToRecord = extractors.edges
        ? extractors.edges(args[0], args[1], args[2], args[3])
        : [];
    const edgesToRecordErrors = edgesToRecord
        ? edgesToRecord.filter(node => node.nodeId === undefined || node.nodeName === undefined)
        : [];
    if (edgesToRecordErrors.length > 0) {
        throw new Error(`Missing info found in edgesToRecord ${JSON.stringify(edgesToRecordErrors)}`);
    }
    // Events need to be in terms of both the edge and the link
    // So one edge revision will lead to two events (one for each node)
    return edgesToRecord.reduce((acc, edge) => {
        const eventOne = {
            ...eventInfoBase,
            linkNodeId: edge.nodeId.toString(),
            linkNodeName: edge.nodeName
        };
        const eventTwo = {
            ...eventInfoBase,
            nodeId: edge.nodeId.toString(),
            nodeName: edge.nodeName,
            linkNodeId: eventInfoBase.nodeName,
            linkNodeName: eventInfoBase.nodeId.toString()
        };
        acc.push(eventOne);
        acc.push(eventTwo);
        return acc;
    }, []);
};

var eventNodeChangeInfoExtractor = async (args, extractors, eventInfoBase, queryShouldTakeNodeSnapshot) => {
    const revisionData = extractors.revisionData(args[0], args[1], args[2], args[3]);
    const nodeSchemaVersion = extractors.nodeSchemaVersion;
    const eventNodeChangeInfoWithoutSnapshot = { ...eventInfoBase, revisionData, nodeSchemaVersion };
    const includeSnapshot = queryShouldTakeNodeSnapshot(eventNodeChangeInfoWithoutSnapshot);
    const snapshot = includeSnapshot
        ? JSON.stringify(await extractors.currentNodeSnapshot(eventInfoBase.nodeId, args))
        : undefined;
    return {
        ...eventNodeChangeInfoWithoutSnapshot,
        snapshot
    };
};

var eventNodeFragmentRegisterInfoExtractor = (args, extractors, eventInfoBase) => {
    // tslint:disable-next-line
    const fragmentToRecord = extractors.parentNode
        ? extractors.parentNode(args[0], args[1], args[2], args[3])
        : undefined;
    if (!fragmentToRecord) {
        return;
    }
    const fragmentToRecordHasAnError = fragmentToRecord &&
        (fragmentToRecord.nodeId === undefined || fragmentToRecord.nodeName === undefined);
    if (fragmentToRecordHasAnError) {
        throw new Error(`Missing info found in fragmentToRecord ${JSON.stringify(fragmentToRecord)}`);
    }
    return {
        childNodeId: eventInfoBase.nodeId.toString(),
        childNodeName: eventInfoBase.nodeName,
        parentNodeId: fragmentToRecord.nodeId.toString(),
        parentNodeName: fragmentToRecord.nodeName
    };
};

const getTxInsertId = async (knex, tx) => {
    const sqlTranslator = getSqlDialectTranslator(knex);
    const { id } = await tx
        .select(tx.raw(`${sqlTranslator.lastInsertedId} as id`))
        .forUpdate()
        .first();
    return id;
};
const createKnexTransaction = async (knex, transactionTimeoutSeconds) => {
    const transaction = await knex.transaction();
    setTimeout(async () => {
        await transaction.rollback();
        // throw new Error('Detected an orphaned transaction');
    }, (transactionTimeoutSeconds || 10) * 1000);
    return transaction;
};

const isEventNodeChangeInfo = (e) => {
    return e.revisionData !== undefined;
};
const isEventNodeChangeWithSnapshotInfo = (e) => {
    return e.snapshot !== undefined;
};
const isEventNodeFragmentRegisterInfo = (e) => {
    return e.childNodeId !== undefined;
};
const isEventLinkChangeInfo = (e) => {
    return e.linkNodeId !== undefined;
};

var EVENT_IMPLEMENTOR_TYPE_IDS;
(function (EVENT_IMPLEMENTOR_TYPE_IDS) {
    EVENT_IMPLEMENTOR_TYPE_IDS[EVENT_IMPLEMENTOR_TYPE_IDS["NODE_CHANGE"] = 1] = "NODE_CHANGE";
    EVENT_IMPLEMENTOR_TYPE_IDS[EVENT_IMPLEMENTOR_TYPE_IDS["NODE_FRAGMENT_CHANGE"] = 2] = "NODE_FRAGMENT_CHANGE";
    EVENT_IMPLEMENTOR_TYPE_IDS[EVENT_IMPLEMENTOR_TYPE_IDS["LINK_CHANGE"] = 3] = "LINK_CHANGE";
})(EVENT_IMPLEMENTOR_TYPE_IDS || (EVENT_IMPLEMENTOR_TYPE_IDS = {}));

/**
 * Write the event to the base event table in the database
 */
var storeEventBase = async (knex, transaction, { table_names }, eventInfo) => {
    // tslint:disable-next-line
    if (isEventNodeFragmentRegisterInfo(eventInfo)) {
        throw new Error('Called data accessor for storing user roles with an event that doesnt contain user role information');
    }
    let implementorTypeId;
    if (isEventNodeChangeInfo(eventInfo)) {
        implementorTypeId = EVENT_IMPLEMENTOR_TYPE_IDS.NODE_CHANGE;
    }
    else if (isEventNodeFragmentRegisterInfo(eventInfo)) {
        implementorTypeId = EVENT_IMPLEMENTOR_TYPE_IDS.NODE_FRAGMENT_CHANGE;
    }
    else if (isEventLinkChangeInfo(eventInfo)) {
        implementorTypeId = EVENT_IMPLEMENTOR_TYPE_IDS.LINK_CHANGE;
    }
    else {
        throw new Error('Unknown event type. Could find find implementor ID');
    }
    // Get the id for event implementor EVENT_NODE_CHANGE
    await transaction.table(table_names.event).insert({
        created_at: eventInfo.createdAt,
        user_id: eventInfo.userId,
        node_name: eventInfo.nodeName,
        node_id: eventInfo.nodeId,
        resolver_operation: eventInfo.resolverOperation,
        implementor_type_id: implementorTypeId
    });
    const eventId = await getTxInsertId(knex, transaction);
    if (eventId === undefined) {
        throw new Error(`Error retrieving event id for event ${JSON.stringify(eventInfo)}`);
    }
    return eventId;
};

/**
 * Write the event to the base event table in the database
 */
var storeUserRoles = async (transaction, { table_names, role, user_role }, eventInfo, eventId) => {
    if (isEventNodeFragmentRegisterInfo(eventInfo)) {
        throw new Error('Called data accessor for storing user roles with an event that doesnt contain user role information');
    }
    // Calculate which role are missing in the db
    let allRoles;
    const foundRolesQueryResult = (await transaction
        .table(table_names.role)
        .whereIn(role.role, eventInfo.userRoles));
    const foundRoleNames = foundRolesQueryResult.map((n) => n[role.role]);
    const missingRoles = eventInfo.userRoles.filter(i => foundRoleNames.indexOf(i) < 0);
    // If there are any missing roles, add them to the database
    if (missingRoles.length > 0) {
        // Insert the missing roles
        await transaction.table(table_names.role).insert(missingRoles.map(r => ({
            [role.role]: r
        })));
        // Select the role ids
        allRoles = (await transaction
            .table(table_names.role)
            .whereIn(role.role, eventInfo.userRoles));
    }
    else {
        allRoles = foundRolesQueryResult;
    }
    // Insert roles ids associated with the revision id
    await transaction.table(table_names.user_role).insert(allRoles.map((roleQueryResult) => ({
        [user_role.role_id]: roleQueryResult[role.id],
        [user_role.event_id]: eventId
    })));
};

/**
 * Write the event link change to the database
 */
var storeEventLinkChange = async (transaction, { table_names, event_link_change }, eventInfo, eventId) => {
    if (isEventLinkChangeInfo(eventInfo)) {
        await transaction
            .table(table_names.event_link_change)
            .insert({
            [event_link_change.event_id]: eventId,
            [event_link_change.node_id]: eventInfo.linkNodeId,
            [event_link_change.node_name]: eventInfo.linkNodeName
        });
    }
    else {
        throw new Error('Called data accessor for storing event link changes with a non link change event');
    }
};

/**
 * Write the event node change to the database
 */
var storeEventNodeChange = async (transaction, { table_names, event_node_change }, eventInfo, eventId) => {
    if (isEventNodeChangeInfo(eventInfo)) {
        await transaction
            .table(table_names.event_node_change)
            .insert({
            [event_node_change.event_id]: eventId,
            [event_node_change.revision_data]: eventInfo.revisionData,
            [event_node_change.node_schema_version]: eventInfo.nodeSchemaVersion
        });
    }
    else {
        throw new Error('Called data accessor for storing event node changes with a non node change event');
    }
};

/**
 * Write the event node fragment registration to the database
 */
var storeEventNodeFragmentRegistration = async (transaction, { table_names, event_node_fragment_register }, eventInfo) => {
    if (isEventNodeFragmentRegisterInfo(eventInfo)) {
        await transaction
            .table(table_names.event_node_fragment_register)
            .insert({
            [event_node_fragment_register.parent_node_id]: eventInfo.parentNodeId,
            [event_node_fragment_register.parent_node_name]: eventInfo.parentNodeName,
            [event_node_fragment_register.child_node_id]: eventInfo.childNodeId,
            [event_node_fragment_register.child_node_name]: eventInfo.childNodeName
        });
    }
    else {
        throw new Error('Called data accessor for storing event node fragment registration with a non node fragment registration event');
    }
};

/**
 * Write the node snapshot to the database
 */
var storeNodeSnapshot = async (transaction, { table_names, node_snapshot }, eventInfo, eventId) => {
    if (isEventNodeChangeWithSnapshotInfo(eventInfo)) {
        await transaction
            .table(table_names.node_snapshot)
            .insert({
            [node_snapshot.snapshot]: JSON.stringify(eventInfo.snapshot),
            [node_snapshot.event_id]: eventId
        });
    }
    else {
        throw new Error('Called data accessor for storing event node change snapshots with a non node change snapshot event');
    }
};

/**
 * Fetch the number of full node snapshots for the node id and node schema version
 * If a snapshot exists within the expected snapshot frequency, then we don't need to take another snapshot
 */
var createQueryShouldStoreSnapshot = (transaction, { table_names, event, node_snapshot }) => async (eventInfo) => {
    const sql = transaction
        .table(table_names.event)
        .leftJoin(table_names.node_snapshot, `${table_names.event}.${event.id}`, `${table_names.node_snapshot}.${node_snapshot.event_id}`)
        .where({
        [`${table_names.event}.${event.node_name}`]: eventInfo.nodeName,
        [`${table_names.event}.${event.node_id}`]: eventInfo.nodeId,
        [`${table_names.node_snapshot}.${node_snapshot.node_schema_version}`]: eventInfo.nodeSchemaVersion
    })
        .orderBy(`${table_names.event}.${event.created_at}`, 'desc')
        .limit(eventInfo.snapshotFrequency)
        .select(
    // TODO remove `event_creation` its not used
    `${table_names.event}.${event.created_at} as event_creation`, `${table_names.node_snapshot}.${node_snapshot.id} as snapshot_creation`);
    const snapshots = (await sql);
    const snapshotWithinFrequencyRange = !!snapshots.find(data => data.snapshot_creation);
    return !snapshotWithinFrequencyRange;
};

const persistVersion = async (versionInfo, { knex, transaction: trx, tableAndColumnNames }) => {
    if (versionInfo.nodeChange) {
        const eventId = await createEventAndUserRoles(knex, trx, tableAndColumnNames, versionInfo.nodeChange);
        await storeEventNodeChange(trx, tableAndColumnNames, versionInfo.nodeChange, eventId);
        if (isEventNodeChangeWithSnapshotInfo(versionInfo.nodeChange)) {
            await storeNodeSnapshot(trx, tableAndColumnNames, versionInfo.nodeChange, eventId);
        }
    }
    if (versionInfo.linkChanges) {
        await Bluebird.each(versionInfo.linkChanges, async (event) => {
            const eventId = await createEventAndUserRoles(knex, trx, tableAndColumnNames, event);
            await storeEventLinkChange(trx, tableAndColumnNames, event, eventId);
        });
    }
    if (versionInfo.fragmentRegistration) {
        await storeEventNodeFragmentRegistration(trx, tableAndColumnNames, versionInfo.fragmentRegistration);
    }
};
const createEventAndUserRoles = async (knex, trx, tableAndColumnNames, eventLinkChangeInfo) => {
    const eventId = await storeEventBase(knex, trx, tableAndColumnNames, eventLinkChangeInfo);
    await storeUserRoles(trx, tableAndColumnNames, eventLinkChangeInfo, eventId);
    return eventId;
};

var version_recorder = (extractors, config) => {
    return (_target, property, descriptor) => {
        const tableAndColumnNames = setNames(config ? config.names : undefined);
        const { value } = descriptor;
        if (typeof value !== 'function') {
            throw new TypeError('Only functions can be decorated.');
        }
        // tslint:disable-next-line
        descriptor.value = (async (...args) => {
            console.log('1. EXTRACTING INFO');
            const localKnexClient = extractors.knex(args[0], args[1], args[2], args[3]);
            const transaction = await createKnexTransaction(localKnexClient);
            console.log('2. GETTING CURRENT NODE');
            const node = await callDecoratedNode(value, args);
            console.log('3. EXTRACTING NODE ID');
            const nodeId = extractors.nodeId(node, args[0], args[1], args[2], args[3]);
            if (nodeId === undefined) {
                throw new Error(`Unable to extract node id in version recorder for node ${JSON.stringify(node)}`);
            }
            const resolverOperation = getResolverOperation(extractors, property);
            const eventInfoBase = eventInfoBaseExtractor(args, extractors, resolverOperation, nodeId);
            const eventLinkChangeInfo = eventLinkChangeInfoExtractor(args, extractors, eventInfoBase);
            const eventNodeFragmentRegisterInfo = eventNodeFragmentRegisterInfoExtractor(args, extractors, eventInfoBase);
            const queryShouldStoreSnapshot = createQueryShouldStoreSnapshot(transaction, tableAndColumnNames);
            const eventNodeChangeInfo = await eventNodeChangeInfoExtractor(args, extractors, eventInfoBase, queryShouldStoreSnapshot);
            await persistVersion({
                linkChanges: eventLinkChangeInfo,
                nodeChange: eventNodeChangeInfo,
                fragmentRegistration: eventNodeFragmentRegisterInfo
            }, { knex: localKnexClient, transaction, tableAndColumnNames });
            await transaction.commit();
            return node;
        });
        return descriptor;
    };
};
const getResolverOperation = (extractors, property) => {
    const rawResolverOperation = extractors.resolverOperation
        ? extractors.resolverOperation
        : property;
    return typeof rawResolverOperation === 'symbol'
        ? rawResolverOperation.toString()
        : rawResolverOperation;
};
const callDecoratedNode = async (value, args) => {
    return await value(args[0], args[1], args[2], args[3]);
};

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
var generator = (config) => {
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

export { generator as createRevisionMigrations, decorate, version_recorder as versionRecorderDecorator };
