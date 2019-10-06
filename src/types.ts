import Knex from 'knex';
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

    node_id: string;
    node_name: string;
}

export interface ISqlEventNodeChangeTable {
    id: number;
    event_id: number;

    revision_data: string;
    node_schema_version: string;
}

export interface ISqlEventNodeFragmentChangeTable {
    id: number;

    child_node_id: string;
    child_node_name: string;
    parent_node_id: string;
    parent_node_name: string;
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
    event_id: string;
    snapshot: string;
}

export type SqlTable<T> = {[k in keyof T]: string};

export interface ISqlColumnNames {
    event: SqlTable<ISqlEventTable>;
    event_implementor_type: SqlTable<ISqlEventImplementorTypeTable>;
    event_link_change: SqlTable<ISqlEventLinkChangeTable>;
    event_node_change: SqlTable<ISqlEventNodeChangeTable>;
    event_node_fragment_register: SqlTable<ISqlEventNodeFragmentChangeTable>;
    role: SqlTable<ISqlRoleTable>;
    user_role: SqlTable<ISqlUserRoleTable>;
    node_snapshot: SqlTable<ISqlNodeSnapshotTable>;
}
export interface ITableAndColumnNames extends ISqlColumnNames {
    table_names: SqlTable<ISqlColumnNames>;
}

/**
 *
 * Graphql Schema
 *
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

    childId: string;
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
 * Extractors (GQL Input -> Data Access Layer)
 *
 */
export interface IVersionRecorderExtractors<Resolver extends (...args: any[]) => any> {
    userId: (
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => string;
    userRoles: (
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => string[];
    revisionData: (
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => string;
    eventTime?: (
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => string;
    knex: (
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => Knex;
    nodeId: (
        node: UnPromisify<ReturnType<Resolver>>,
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => INode['nodeId'] | undefined; // tslint:disable-line
    nodeSchemaVersion: number | string;
    nodeName: string;
    resolverOperation?: string;
    passThroughTransaction?: boolean;
    currentNodeSnapshot: (
        nodeId: INode['nodeId'],
        resolverArgs: Parameters<Resolver>
    ) => ReturnType<Resolver>; // tslint:disable-line
    currentNodeSnapshotFrequency?: number;
    parentNode?: (
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => INode;
    edges?: (
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => INode[];
}

export interface INode {
    nodeId: number | string;
    nodeName: string;
}

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

export interface IEventNodeChangeWithSnapshotInfo extends IEventInfoBase {
    createdAt: string;
    userId: string;
    nodeName: string;
    nodeId: string | number;
    resolverOperation: string;
    userRoles: string[];
    snapshotFrequency: number;

    revisionData: string;
    nodeSchemaVersion: string | number;

    snapshot: string;
}

export interface IEventNodeFragmentRegisterInfo {
    childNodeId: string | number;
    childNodeName: string;
    parentNodeId: string | number;
    parentNodeName: string;
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

/**
 *
 * Data access layer
 *
 */

export interface IEventInterfaceTypesToIdsMap {
    [type: string]: number;
}

export type EventInfo =
    | IEventNodeChangeInfo
    | IEventNodeChangeWithSnapshotInfo
    | IEventNodeFragmentRegisterInfo
    | IEventLinkChangeInfo;

export interface IPersistVersionInfo {
    nodeChange: IEventNodeChangeInfo | IEventNodeChangeWithSnapshotInfo;
    linkChanges?: IEventLinkChangeInfo[];
    fragmentRegistration?: IEventNodeFragmentRegisterInfo;
}

export type PersistVersion = (versionInfo: IPersistVersionInfo) => Promise<any>;

/**
 *
 * Resolvers
 *
 */

export type UnPromisify<T> = T extends Promise<infer U> ? U : T;

export type ResolverArgs<T> = T extends (node: any, parent: any, args: infer A) => any
    ? A
    : undefined;

export type ContextArgs<T> = T extends (node: any, parent: any, args: any, ctx: infer A) => any
    ? A
    : undefined;

export type BaseResolver<Node = any, P = undefined, A = undefined, C = {}, I = {}> = (
    parent: P,
    args: A,
    ctx: C,
    info?: I
) => Node | Promise<Node>;

/**
 *
 * Utilities
 *
 */

// tslint:disable
export type Unpacked<T> = T extends (infer U)[]
    ? U
    : T extends (...args: any[]) => infer U
    ? U
    : T extends Promise<infer U>
    ? U
    : T;
// tslint:enable

export type InfoArgs<T> = T extends (
    node: any,
    parent: any,
    args: any,
    ctx: any,
    info: infer A
) => any
    ? A
    : undefined;
