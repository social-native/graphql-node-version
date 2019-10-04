export type BaseResolver<Node = any, P = undefined, A = undefined, C = {}, I = {}> = (
    parent: P,
    args: A,
    ctx: C,
    info?: I
) => Node | Promise<Node>;

export interface INodeChange {
    userId: number;
    userRoles?: string[];
    revisionId: number;
    revisionData: string;
    revisionTime: number;
    nodeSchemaVersion: number;
    resolverOperation: string;
    nodeName: string;
}

export interface ILinkChange {
    edgeNodeId: number;
    edgeNodeName: string;
    resolverOperation: string;
    revisionTime: number;
}

export interface IVersionConnection<Node> {
    edges: Array<{
        cursor: string;
        nodeChange?: INodeChange;
        linkChange?: ILinkChange;
        node: Node;
    }>;
    pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor: string;
        endCursor: string;
    };
}
export interface INamesConfig {
    tableNames?: {
        event?: string;
        eventImplementorType?: string;
        eventNodeChange?: string;
        eventNodeChangeFragment?: string;
        eventLinkChange?: string;

        role?: string;
        userRole?: string;
        nodeSnapshot?: string;
    };
    columnNames?: {
        eventId?: string;
        eventTime?: string;
        eventUserId?: string;
        eventNodeName?: string;
        eventNodeId?: string;
        eventResolverOperation?: string;

        eventImplementorTypeId?: string;
        eventImplementorType?: string;

        linkChangeId?: string;
        linkChangeNodeNameA?: string;
        linkChangeNodeIdA?: string;
        linkChangeNodeNameB?: string;
        linkChangeNodeIdB?: string;

        nodeChangeId?: string;
        nodeChangeRevisionData?: string;
        nodeChangeNodeSchemaVersion?: string;

        nodeChangeFragmentId?: string;
        nodeChangeFragmentTime?: string;
        nodeChangeFragmentParentNodeId?: string;
        nodeChangeFragmentParentNodeName?: string;
        nodeChangeFragmentChildNodeId?: string;
        nodeChangeFragmentChildNodeName?: string;

        snapshotId?: string;
        snapshotTime?: string;
        snapshotData?: string;

        roleId?: string;
        roleName?: string;

        userRoleId?: string;
    };
}

export interface INamesForTablesAndColumns {
    tableNames: {
        [tableName in keyof Required<Required<INamesConfig>['tableNames']>]: string;
    };
    columnNames: {
        [columnName in keyof Required<Required<INamesConfig>['columnNames']>]: string;
    };
}

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

export interface IRevisionInput {
    // id: string;
    userId: string;
    userRoles?: string[];
    revisionData: string;
    revisionTime: string;
    nodeSchemaVersion: number;
    resolverOperation: string;
    nodeName: string;
    nodeId?: string | number;
}

export interface INodeBuilderRevisionInfo {
    revisionData: string;
    revisionTime: string;
    revisionId: number;
    snapshotData?: string;
    nodeSchemaVersion: number;
    nodeName: string;
    nodeId: string | number;
    resolverOperation?: string;
}

export interface IRevisionQueryResult<RevisionTime = string> {
    revisionId: number;
    revisionTime: RevisionTime;
    revisionData: string;

    nodeName: string;
    nodeSchemaVersion: number;
    userId: number;
    nodeId: string | number;
    resolverOperation: string;

    snapshotTime?: string;
    snapshotData?: string;

    userRoles?: string[];
}

export interface ITransformInput {
    columnNames: NonNullable<INamesForTablesAndColumns['columnNames']> & {[column: string]: any};
    columnData: NonNullable<INodeChange> & {[column: string]: any};
}

// tslint:disable
export type Unpacked<T> = T extends (infer U)[]
    ? U
    : T extends (...args: any[]) => infer U
    ? U
    : T extends Promise<infer U>
    ? U
    : T;
// tslint:enable
