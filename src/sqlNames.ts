import {INamesConfig, INamesForTablesAndColumns} from './types';

/**
 * Sets the names for tables and columns that revisions will be stored in
 *
 * Allows users to specify their own column and table names. If none are specified, the defaults will be used.
 */

enum DEFAULT_TABLE_NAMES {
    revision = 'revision',
    revisionRole = 'revision_role',
    revisionUserRole = 'revision_user_roles',
    revisionNodeSnapshot = 'revision_node_snapshot'
}

enum DEFAULT_COLUMN_NAMES {
    // revision table
    revisionId = 'id',
    revisionTime = 'revision_created_at',
    userId = 'user_id',
    revisionData = 'revision',
    nodeName = 'node_name',
    nodeSchemaVersion = 'node_schema_version',
    nodeId = 'node_id',
    resolverName = 'resolver_name',

    // revision node snapshot table
    snapshotId = 'id',
    snapshotTime = 'snapshot_created_at',
    snapshotData = 'previous_node_version_snapshot',

    // revision role table
    roleId = 'id',
    roleName = 'role_name',

    // revision user roles
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
