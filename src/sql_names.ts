import {
    // INamesConfig,
    // INamesForTablesAndColumns,
    ISqlEventTable,
    ISqlEventImplementorTypeTable,
    ISqlEventLinkChangeTable,
    ISqlEventNodeChangeTable,
    ISqlEventNodeFragmentChangeTable,
    ISqlRoleTable,
    ISqlUserRoleTable,
    ISqlNodeSnapshotTable,
    SqlTable,
    ISqlColumnNames,
    ITableAndColumnNames
} from './types';

/**
 * Sets the names for tables and columns that revisions will be stored in
 *
 * Allows users to specify their own column and table names. If none are specified, the defaults will be used.
 */

/**
 * TABLE NAMES
 */

export const DEFAULT_SQL_TABLE_NAMES: SqlTable<ISqlColumnNames> = {
    event: 'event',
    event_implementor_type: 'event_implementor_type',
    event_link_change: 'event_link_change',
    event_node_change: 'event_node_change',
    event_node_fragment_change: 'event_node_fragment_change',
    role: 'role',
    user_role: 'user_role',
    node_snapshot: 'node_snapshot'
};

/**
 * COLUMN NAMES
 */

export const DEFAULT_COLUMN_NAMES_EVENT_TABLE: SqlTable<ISqlEventTable> = {
    id: 'id',
    created_at: 'created_at',
    user_id: 'user_id',
    node_name: 'node_name',
    node_id: 'node_id',
    resolver_operation: 'resolver_operation',
    implementor_type_id: 'implementor_type_id'
};

export const DEFAULT_COLUMN_NAMES_EVENT_IMPLEMENTOR_TYPE_TABLE: SqlTable<
    ISqlEventImplementorTypeTable
> = {
    id: 'id',
    type: 'type'
};

export const DEFAULT_COLUMN_NAMES_EVENT_LINK_CHANGE_TABLE: SqlTable<ISqlEventLinkChangeTable> = {
    id: 'id',
    event_id: 'event_id',
    node_name_a: 'node_name_a',
    node_id_a: 'node_id_a',
    node_name_b: 'node_name_b',
    node_id_b: 'node_id_b'
};

export const DEFAULT_COLUMN_NAMES_EVENT_NODE_CHANGE_TABLE: SqlTable<ISqlEventNodeChangeTable> = {
    id: 'id',
    event_id: 'event_id',
    revision_data: 'revision_data',
    node_schema_version: 'schema_version'
};

export const DEFAULT_COLUMN_NAMES_EVENT_NODE_FRAGMENT_CHANGE_TABLE: SqlTable<
    ISqlEventNodeFragmentChangeTable
> = {
    id: 'id',
    created_at: 'created_at',
    parent_node_id: 'parent_node_id',
    parent_node_name: 'parent_node_name',
    child_node_id: 'child_node_id',
    child_node_name: 'child_node_name'
};

export const DEFAULT_COLUMN_NAMES_ROLE_TABLE: SqlTable<ISqlRoleTable> = {
    id: 'id',
    role: 'role'
};

export const DEFAULT_COLUMN_NAMES_USER_ROLE_TABLE: SqlTable<ISqlUserRoleTable> = {
    id: 'id',
    role_id: 'role_id',
    event_id: 'event_id'
};

export const DEFAULT_COLUMN_NAMES_SNAPSHOT_TABLE: SqlTable<ISqlNodeSnapshotTable> = {
    id: 'id',
    created_at: 'created_at',
    snapshot: 'snapshot',
    node_schema_version: 'node_schema_version',
    node_id: 'node_id',
    node_name: 'node_name'
};

// enum DEFAULT_TABLE_NAMES {
//     event = 'version_event',
//     eventImplementorType = 'version_event_implementor_type',
//     eventNodeChange = 'version_event_node_change',
//     eventNodeChangeFragment = 'version_event_node_change_fragment',
//     eventLinkChange = 'version_event_link_change',

//     role = 'version_role',
//     userRole = 'version_user_role',
//     nodeSnapshot = 'version_node_snapshot'
// }

// enum DEFAULT_COLUMN_NAMES {
//     // event table
//     // (base table)
//     eventId = 'id',
//     eventTime = 'created_at',
//     eventUserId = 'user_id',
//     eventNodeName = 'node_name',
//     eventNodeId = 'node_id',
//     eventResolverOperation = 'resolver_operation',

//     // event type table
//     // (implementor type)
//     eventImplementorTypeId = 'id',
//     eventImplementorType = 'event_type',

//     // event link change table
//     // (implementor)
//     linkChangeId = 'id',
//     linkChangeNodeNameA = 'node_name_a',
//     linkChangeNodeIdA = 'node_id_a',
//     linkChangeNodeNameB = 'node_name_b',
//     linkChangeNodeIdB = 'node_id_b',

//     // event node change table
//     // (implementor)
//     nodeChangeId = 'id',
//     nodeChangeRevisionData = 'revision',
//     nodeChangeNodeSchemaVersion = 'node_schema_version',

//     // event node change fragment table
//     nodeChangeFragmentId = 'id',
//     nodeChangeFragmentTime = 'created_at',
//     nodeChangeFragmentParentNodeId = 'parent_node_id',
//     nodeChangeFragmentParentNodeName = 'parent_node_name',
//     nodeChangeFragmentChildNodeId = 'child_node_id',
//     nodeChangeFragmentChildNodeName = 'child_node_name',

//     // node snapshot table
//     snapshotId = 'id',
//     snapshotTime = 'created_at',
//     snapshotData = 'snapshot',
//     snapshotNodeSchemaVersion = 'node_schema_version',

//     // role table
//     roleId = 'id',
//     roleName = 'role_name',

//     // user role table
//     userRoleId = 'id'
// }

export const setNames = (names?: ITableAndColumnNames): ITableAndColumnNames => {
    // tslint:disable
    const tableNames = (names && names.table_names) || {};
    const event = (names && names.event) || {};
    const event_implementor_type = (names && names.event_implementor_type) || {};
    const event_link_change = (names && names.event_link_change) || {};
    const event_node_change = (names && names.event_node_change) || {};
    const event_node_fragment_change = (names && names.event_node_fragment_change) || {};
    const role = (names && names.role) || {};
    const user_role = (names && names.user_role) || {};
    const node_snapshot = (names && names.node_snapshot) || {};
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
        event_node_fragment_change: {
            ...DEFAULT_COLUMN_NAMES_EVENT_NODE_FRAGMENT_CHANGE_TABLE,
            ...event_node_fragment_change
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
