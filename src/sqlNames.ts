import {INamesConfig, INamesForTablesAndColumns} from './types';

/**
 * Sets the names for tables and columns that revisions will be stored in
 *
 * Allows users to specify their own column and table names. If none are specified, the defaults will be used.
 */

enum DEFAULT_TABLE_NAMES {
    event = 'version_event',
    eventImplementorType = 'version_event_implementor_type',
    eventNodeChange = 'version_event_node_change',
    eventNodeChangeFragment = 'version_event_node_change_fragment',
    eventLinkChange = 'version_event_link_change',

    role = 'version_role',
    userRole = 'version_user_role',
    nodeSnapshot = 'version_node_snapshot'
}

enum DEFAULT_COLUMN_NAMES {
    // event table
    // (base table)
    eventId = 'id',
    eventTime = 'created_at',
    eventUserId = 'user_id',
    eventNodeName = 'node_name',
    eventNodeId = 'node_id',
    eventResolverOperation = 'resolver_operation',

    // event type table
    // (implementor type)
    eventImplementorTypeId = 'id',
    eventImplementorType = 'event_type',

    // event link change table
    // (implementor)
    linkChangeId = 'id',
    linkChangeNodeNameA = 'node_name_a',
    linkChangeNodeIdA = 'node_id_a',
    linkChangeNodeNameB = 'node_name_b',
    linkChangeNodeIdB = 'node_id_b',

    // event node change table
    // (implementor)
    nodeChangeId = 'id',
    nodeChangeRevisionData = 'revision',
    nodeChangeNodeSchemaVersion = 'node_schema_version',

    // event node change fragment table
    nodeChangeFragmentId = 'id',
    nodeChangeFragmentTime = 'created_at',
    nodeChangeFragmentParentNodeId = 'parent_node_id',
    nodeChangeFragmentParentNodeName = 'parent_node_name',
    nodeChangeFragmentChildNodeId = 'child_node_id',
    nodeChangeFragmentChildNodeName = 'child_node_name',

    // node snapshot table
    snapshotId = 'id',
    snapshotTime = 'created_at',
    snapshotData = 'snapshot',

    // role table
    roleId = 'id',
    roleName = 'role_name',

    // user role table
    userRoleId = 'id'
}

export const setNames = ({tableNames, columnNames}: INamesConfig): INamesForTablesAndColumns => ({
    tableNames: {
        ...DEFAULT_TABLE_NAMES,
        ...tableNames
    },
    columnNames: {
        ...DEFAULT_COLUMN_NAMES,
        ...columnNames
    }
});
