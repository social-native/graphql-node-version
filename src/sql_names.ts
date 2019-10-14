import {
    ISqlEventTable,
    ISqlEventImplementorTypeTable,
    ISqlEventLinkChangeTable,
    ISqlEventNodeChangeTable,
    ISqlEventNodeFragmentChangeTable,
    ISqlRoleTable,
    ISqlUserRoleTable,
    ISqlNodeSnapshotTable,
    StringValueWithKey,
    ISqlColumnNames,
    ITableAndColumnNames
} from './types';

/**
 * Sets the names for tables and columns that node version info will be stored in
 *
 * Allows users to specify their own column and table names. If none are specified, the defaults will be used.
 */

/**
 * TABLE NAMES
 */

export const DEFAULT_SQL_TABLE_NAMES: StringValueWithKey<ISqlColumnNames> = {
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

export const DEFAULT_COLUMN_NAMES_EVENT_TABLE: StringValueWithKey<ISqlEventTable> = {
    id: 'id',
    created_at: 'created_at',
    user_id: 'user_id',
    node_name: 'node_name',
    node_id: 'node_id',
    resolver_operation: 'resolver_operation',
    implementor_type_id: 'implementor_type_id'
};

export const DEFAULT_COLUMN_NAMES_EVENT_IMPLEMENTOR_TYPE_TABLE: StringValueWithKey<
    ISqlEventImplementorTypeTable
> = {
    id: 'id',
    type: 'type'
};

export const DEFAULT_COLUMN_NAMES_EVENT_LINK_CHANGE_TABLE: StringValueWithKey<
    ISqlEventLinkChangeTable
> = {
    id: 'id',
    event_id: 'event_id',
    node_name: 'node_name',
    node_id: 'node_id'
};

export const DEFAULT_COLUMN_NAMES_EVENT_NODE_CHANGE_TABLE: StringValueWithKey<
    ISqlEventNodeChangeTable
> = {
    id: 'id',
    event_id: 'event_id',
    revision_data: 'revision_data',
    node_schema_version: 'schema_version'
};

export const DEFAULT_COLUMN_NAMES_EVENT_NODE_FRAGMENT_REGISTER_TABLE: StringValueWithKey<
    ISqlEventNodeFragmentChangeTable
> = {
    id: 'id',
    parent_node_id: 'parent_node_id',
    parent_node_name: 'parent_node_name',
    child_node_id: 'child_node_id',
    child_node_name: 'child_node_name'
};

export const DEFAULT_COLUMN_NAMES_ROLE_TABLE: StringValueWithKey<ISqlRoleTable> = {
    id: 'id',
    role: 'role'
};

export const DEFAULT_COLUMN_NAMES_USER_ROLE_TABLE: StringValueWithKey<ISqlUserRoleTable> = {
    id: 'id',
    role_id: 'role_id',
    event_id: 'event_id'
};

export const DEFAULT_COLUMN_NAMES_SNAPSHOT_TABLE: StringValueWithKey<ISqlNodeSnapshotTable> = {
    id: 'id',
    event_id: 'event_id',
    snapshot: 'snapshot',
    node_schema_version: 'node_schema_version'
};

/**
 * Override default table and column names
 */

export const generateTableAndColumnNames = (names?: ITableAndColumnNames): ITableAndColumnNames => {
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
