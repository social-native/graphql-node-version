// import {EVENT_IMPLEMENTOR_TYPES} from 'enums';

export type BaseResolver<Node = any, P = undefined, A = undefined, C = {}, I = {}> = (
    parent: P,
    args: A,
    ctx: C,
    info?: I
) => Node | Promise<Node>;

// tslint:disable
export type Unpacked<T> = T extends (infer U)[]
    ? U
    : T extends (...args: any[]) => infer U
    ? U
    : T extends Promise<infer U>
    ? U
    : T;
// tslint:enable

// export interface INodeChange {
//     userId: number;
//     userRoles?: string[];
//     revisionId: number;
//     revisionData: string;
//     revisionTime: number;
//     nodeSchemaVersion: string;
//     resolverOperation: string;
//     nodeName: string;
// }

// export interface ILinkChange {
//     edgeNodeId: number;
//     edgeNodeName: string;
//     resolverOperation: string;
//     revisionTime: number;
// }

export interface IVersionConnection<Node> {
    edges: Array<{
        cursor: string;
        version: IGqlVersionNode;
        node: Node;
    }>;
    pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor: string;
        endCursor: string;
    };
}

/**
 *
 *  SQL Tables
 *
 */

export interface ISqlEventTable {
    id: string;
    created_at: string;
    user_id: string;
    node_name: string;
    node_id: string;
    resolver_operation: string;
    implementor_type_id: number;
}

export interface ISqlEventImplementorTypeTable {
    id: string;
    type: string;
}

export interface ISqlEventLinkChangeTable {
    id: number;
    event_id: number;
    node_name_a: string;
    node_id_a: string;
    node_name_b: string;
    node_id_b: string;
}

export interface ISqlEventNodeChangeTable {
    id: number;
    event_id: number;
    revision_data: string;
    node_schema_version: string;
}

export interface ISqlEventNodeFragmentChangeTable {
    id: number;
    created_at: string;
    parent_node_id: string;
    parent_node_name: string;
    child_node_id: string;
    child_node_name: string;
}

export interface ISqlRoleTable {
    id: number;
    role: string;
}

export interface ISqlUserRoleTable {
    id: number;
    role_id: number;
    event_id: number;
}

export interface ISqlNodeSnapshotTable {
    id: number;
    created_at: string;
    snapshot: string;
    node_id: string;
    node_name: string;
    node_schema_version: string;
}

export type SqlTable<T> = {[k in keyof T]: string};

export interface ISqlColumnNames {
    event: SqlTable<ISqlEventTable>;
    event_implementor_type: SqlTable<ISqlEventImplementorTypeTable>;
    event_link_change: SqlTable<ISqlEventLinkChangeTable>;
    event_node_change: SqlTable<ISqlEventNodeChangeTable>;
    event_node_fragment_change: SqlTable<ISqlEventNodeFragmentChangeTable>;
    role: SqlTable<ISqlRoleTable>;
    user_role: SqlTable<ISqlUserRoleTable>;
    node_snapshot: SqlTable<ISqlNodeSnapshotTable>;
}
export interface ITableAndColumnNames extends ISqlColumnNames {
    table_names: SqlTable<ISqlColumnNames>;
}

/**
 * Graphql Schema
 */

export interface IGqlVersionNodeBase {
    id: string;
    createdAt: number;
    userId: string;
    nodeName: string;
    nodeId: string;
    resolverOperation: string;
    type: string;
    userRoles: string[];
}

export interface IGqlVersionNodeChangeNode extends IGqlVersionNodeBase {
    id: string;
    createdAt: number;
    userId: string;
    nodeName: string;
    nodeId: string;
    resolverOperation: string;
    type: string;
    userRoles: string[];

    revisionData: string;
    nodeSchemaVersion: string;
}

export interface IGqlVersionNodeFragmentChangeNode extends IGqlVersionNodeBase {
    id: string;
    createdAt: number;
    userId: string;
    nodeName: string;
    nodeId: string;
    resolverOperation: string;
    type: string;
    userRoles: string[];

    childNodeId: string;
    childNodeName: string;
}

export interface IGqlVersionLinkChangeNode extends IGqlVersionNodeBase {
    id: string;
    createdAt: number;
    userId: string;
    nodeName: string;
    nodeId: string;
    resolverOperation: string;
    type: string;
    userRoles: string[];

    linkNodeId: string;
    linkNodeName: string;
}

export type IGqlVersionNode =
    | IGqlVersionNodeChangeNode
    | IGqlVersionNodeFragmentChangeNode
    | IGqlVersionLinkChangeNode;

/**
 * Extractors (GQL Input -> Data Access Layer)
 */

export interface IEventInfoBase {
    createdAt: string;
    userId: string;
    nodeName: string;
    nodeId: string | number;
    resolverOperation: string;
    userRoles: string[];
    snapshotFrequency: number;
}

export interface IEventNodeChangeInfo extends IEventInfoBase {
    createdAt: string;
    userId: string;
    nodeName: string;
    nodeId: string | number;
    resolverOperation: string;
    userRoles: string[];
    snapshotFrequency: number;

    revisionData: string;
    nodeSchemaVersion: string | number;
}

export interface IEventNodeFragmentChangeInfo extends IEventInfoBase {
    createdAt: string;
    userId: string;
    nodeName: string;
    nodeId: string | number;
    resolverOperation: string;
    userRoles: string[];
    snapshotFrequency: number;

    childNodeId: string | number;
    childNodeName: string;
}

export interface IEventLinkChangeInfo extends IEventInfoBase {
    createdAt: string;
    userId: string;
    nodeName: string;
    nodeId: string | number;
    resolverOperation: string;
    userRoles: string[];
    snapshotFrequency: number;

    linkNodeId: string | number;
    linkNodeName: string;
}

export interface ISnapshotInfo {
    createdAt: string;
    snapshot: string;
    nodeSchemaVersion: string;
    nodeId: string | number;
    nodeName: string;
}
/**
 * Data access layer
 */

export interface IEventInterfaceTypesToIdsMap {
    [type: string]: number;
}

export type EventInfo = IEventNodeChangeInfo | IEventNodeFragmentChangeInfo | IEventLinkChangeInfo;
// ISqlEventImplementorTypeTable &
//     ISqlEventTable &
//     ISqlEventLinkChangeTable &
//     ISqlEventNodeChangeTable &
//     ISqlEventNodeFragmentChangeTable &
//     ISqlRoleTable &
//     ISqlUserRoleTable &
//     ISqlNodeSnapshotTable;

// export type EventNodeChangeInsert = Partial<
//     ISqlEventTable & ISqlEventNodeChangeTable & {roles: Array<ISqlRoleTable['role']>}
// >;
// export type EventLinkChangeInsert = Partial<ISqlEventTable & ISqlEventLinkChangeTable>;
// export type NodeSnapshotInsert = Partial<ISqlNodeSnapshotTable>;
// export type EventNodeFragmentChangeInsert = Partial<ISqlEventNodeFragmentChangeTable>;

// export interface INamesConfig {
//     tableNames?: {
//         event?: string;
//         eventImplementorType?: string;
//         eventLinkChange?: string;
//         eventNodeChange?: string;
//         eventNodeChangeFragment?: string;

//         role?: string;
//         userRole?: string;
//         nodeSnapshot?: string;
//     };
//     columnNames?: {
//         eventId?: string;
//         eventTime?: string;
//         eventUserId?: string;
//         eventNodeName?: string;
//         eventNodeId?: string;
//         eventResolverOperation?: string;

//         eventImplementorTypeId?: string;
//         eventImplementorType?: string;

//         linkChangeId?: string;
//         linkChangeNodeNameA?: string;
//         linkChangeNodeIdA?: string;
//         linkChangeNodeNameB?: string;
//         linkChangeNodeIdB?: string;

//         nodeChangeId?: string;
//         nodeChangeRevisionData?: string;
//         nodeChangeNodeSchemaVersion?: string;

//         nodeChangeFragmentId?: string;
//         nodeChangeFragmentTime?: string;
//         nodeChangeFragmentParentNodeId?: string;
//         nodeChangeFragmentParentNodeName?: string;
//         nodeChangeFragmentChildNodeId?: string;
//         nodeChangeFragmentChildNodeName?: string;

//         snapshotId?: string;
//         snapshotTime?: string;
//         snapshotData?: string;
//         snapshotNodeSchemaVersion?: string;

//         roleId?: string;
//         roleName?: string;

//         userRoleId?: string;
//     };
// }

// export interface INamesForTablesAndColumns {
//     tableNames: {
//         [tableName in keyof Required<Required<INamesConfig>['tableNames']>]: string;
//     };
//     columnNames: {
//         [columnName in keyof Required<Required<INamesConfig>['columnNames']>]: string;
//     };
// }

export type UnPromisify<T> = T extends Promise<infer U> ? U : T;

export type ResolverArgs<T> = T extends (node: any, parent: any, args: infer A) => any
    ? A
    : undefined;

export type ContextArgs<T> = T extends (node: any, parent: any, args: any, ctx: infer A) => any
    ? A
    : undefined;

export type InfoArgs<T> = T extends (
    node: any,
    parent: any,
    args: any,
    ctx: any,
    info: infer A
) => any
    ? A
    : undefined;

// export interface IRevisionInput {
//     // id: string;
//     userId: string;
//     userRoles?: string[];
//     revisionData: string;
//     revisionTime: string;
//     nodeSchemaVersion: string;
//     resolverOperation: string;
//     nodeName: string;
//     nodeId?: string | number;
// }

// export interface INodeBuilderRevisionInfo {
//     revisionData: string;
//     revisionTime: string;
//     revisionId: number;
//     snapshotData?: string;
//     nodeSchemaVersion: string;
//     nodeName: string;
//     nodeId: string | number;
//     resolverOperation?: string;
// }

// export interface IRevisionQueryResult<RevisionTime = string> {
//     revisionId: number;
//     revisionTime: RevisionTime;
//     revisionData: string;

//     nodeName: string;
//     nodeSchemaVersion: string;
//     userId: number;
//     nodeId: string | number;
//     resolverOperation: string;

//     snapshotTime?: string;
//     snapshotData?: string;

//     userRoles?: string[];
// }

// export interface ITransformInput {
//     columnNames: NonNullable<INamesForTablesAndColumns['columnNames']> & {[column: string]: any};
//     columnData: NonNullable<INodeChange> & {[column: string]: any};
// }
