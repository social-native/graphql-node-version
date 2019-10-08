import Knex from 'knex';
import pino from 'pino';

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
    node_schema_version: string;
}

export type StringValueWithKey<T> = {[k in keyof T]: string};

export interface ISqlColumnNames {
    event: StringValueWithKey<ISqlEventTable>;
    event_implementor_type: StringValueWithKey<ISqlEventImplementorTypeTable>;
    event_link_change: StringValueWithKey<ISqlEventLinkChangeTable>;
    event_node_change: StringValueWithKey<ISqlEventNodeChangeTable>;
    event_node_fragment_register: StringValueWithKey<ISqlEventNodeFragmentChangeTable>;
    role: StringValueWithKey<ISqlRoleTable>;
    user_role: StringValueWithKey<ISqlUserRoleTable>;
    node_snapshot: StringValueWithKey<ISqlNodeSnapshotTable>;
}
export interface ITableAndColumnNames extends ISqlColumnNames {
    table_names: StringValueWithKey<ISqlColumnNames>;
}

/**
 *
 * Graphql Schema
 *
 */

export interface IGqlVersionNodeBase {
    id: string;
    createdAt: number;
    nodeId: string;
    nodeName: string;
    resolverOperation: string;
    type: string;
    userId: string;
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

export type NodeInConnection = IGqlVersionNode & {snapshot?: string};

export interface IVersionConnection<Node> {
    edges: Array<{
        cursor: string;
        version?: IGqlVersionNode;
        node?: Node;
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

export interface IVersionConnectionInfo<Resolver extends (...args: any[]) => any> {
    nodeId: string | number;
    nodeName: string;
    nodeBuilder: (
        previousModel: UnPromisify<ReturnType<Resolver>>,
        versionInfo: INodeBuilderVersionInfo
    ) => UnPromisify<ReturnType<any>>;
}
export interface IVersionConnectionExtractors<Resolver extends (...args: any[]) => any>
    extends IVersionConnectionInfo<Resolver> {
    knex: Knex;
    nodeId: IVersionConnectionInfo<Resolver>['nodeId'];
    nodeName: IVersionConnectionInfo<Resolver>['nodeName'];
    nodeBuilder: IVersionConnectionInfo<Resolver>['nodeBuilder'];
}

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
    // passThroughTransaction?: boolean;
    currentNodeSnapshot: (
        nodeId: INode['nodeId'],
        resolverArgs: Parameters<Resolver>
    ) => Promise<any>; // tslint:disable-line
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

    snapshot?: string;
}

export interface IEventNodeChangeWithSnapshotInfo extends IEventNodeChangeInfo {
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

export type AllEventInfo =
    | IEventNodeChangeInfo
    | IEventNodeFragmentRegisterInfo
    | IEventLinkChangeInfo;

export interface IPersistVersionInfo {
    nodeChange: IEventNodeChangeInfo;
    linkChanges?: IEventLinkChangeInfo[];
    fragmentRegistration?: IEventNodeFragmentRegisterInfo;
}

export type PersistVersion = (versionInfo: IPersistVersionInfo) => Promise<void>;

export interface INodeBuilderVersionInfo<CreatedAt = number> {
    type: string;

    id: number;
    createdAt: CreatedAt;
    nodeName: string;
    nodeId: string;
    userId: string;
    resolverOperation: string;

    revisionData?: string;
    nodeSchemaVersion?: string;

    snapshot?: string;
}

export type QueryShouldTakeNodeSnapshot = (eventInfo: IEventNodeChangeInfo) => Promise<boolean>;

/**
 *
 * Resolvers
 *
 */

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

export type BaseResolver<Node = any, P = undefined, A = undefined, C = {}, I = {}> = (
    parent: P,
    args: A,
    ctx: C,
    info?: I
) => Node | Promise<Node>;

/**
 *
 * Version API
 *
 */

export interface IConfig extends ILoggerConfig {
    logOptions?: pino.LoggerOptions;
    logger?: ReturnType<typeof pino>;
    names?: ITableAndColumnNames;
}

export interface ILoggerConfig {
    logOptions?: pino.LoggerOptions;
    logger?: ReturnType<typeof pino>;
}

/**
 *
 * Utilities
 *
 */

export type UnPromisify<T> = T extends Promise<infer U> ? U : T;

// tslint:disable
export type Unpacked<T> = T extends (infer U)[]
    ? U
    : T extends (...args: any[]) => infer U
    ? U
    : T extends Promise<infer U>
    ? U
    : T;
// tslint:enable
