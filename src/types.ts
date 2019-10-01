export type BaseResolver<Node = any, P = undefined, A = undefined, C = {}, I = {}> = (
    parent: P,
    args: A,
    ctx: C,
    info?: I
) => Node | Promise<Node>;

// TODO add permissions for campaign users to get the name of other campaign users for their campaign

export interface IRevisionConnection<Node> {
    edges: Array<{
        cursor: string;
        version: IRevisionInfo;
        node: Node;
    }>;
    pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor: string;
        endCursor: string;
    };
}

// type ColumnNames =
//     | 'userId'
//     | 'userRoles'
//     | 'revisionData'
//     | 'revisionTime'
//     | 'nodeSchemaVersion'
//     | 'nodeName'
//     | 'nodeId';

// type TableNames = 'revision' | 'revisionRole' | 'revisionUserRole';

export interface INamesConfig {
    tableNames?: {
        revision?: string;
        revisionRole?: string;
        revisionUserRole?: string;
        revisionNodeSnapshot?: string;
        revisionEdge?: string;
        revisionFragment?: string;
    };
    columnNames?: {
        revisionId?: string;
        revisionTime?: string;
        userId?: string;
        revisionData?: string;
        nodeName?: string;
        nodeSchemaVersion?: string;
        nodeId?: string;
        resolverOperation?: string;

        snapshotId?: string;
        snapshotTime?: string;
        snapshotData?: string;

        roleId?: string;
        roleName?: string;

        userRoleId?: string;

        revisionEdgeId?: string;
        revisionEdgeTime?: string;
        edgeNodeNameA: string;
        edgeNodeIdA: string;
        edgeNodeNameB: string;
        edgeNodeIdB: string;

        revisionFragmentId?: string;
        revisionFragmentTime?: string;
        fragmentParentNodeId: string;
        fragmentParentNodeName: string;
        // fragmentChildNodeId: string;
        // fragmentChildNodeName: string;
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

// export interface IVersionInfo {
//     userId: string;
//     userRoles: string[];
//     revisionId: number;
//     revisionData?: string;
//     revisionTime: string;
//     nodeSchemaVersion: number;
//     resolverOperation: string;
//     nodeName: string;
//     nodeId: string | number;
// }

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

export interface IRevisionInfo {
    // id: string;
    userId: string;
    userRoles?: string[];
    revisionId: number;
    revisionData: string;
    revisionTime: string;
    nodeSchemaVersion: number;
    resolverOperation: string;
    nodeName: string;
    nodeId: string;
}

export interface INodeBuilderRevisionInfo {
    revisionData: string;
    revisionTime: string;
    revisionId: string;
    snapshotData?: string;
    nodeSchemaVersion: number;
    nodeName: string;
    nodeId: string | number;
    resolverOperation?: string;
}

export interface IRevisionQueryResult {
    revisionId: string;
    revisionTime: string;
    revisionData: string;

    nodeName: string;
    nodeSchemaVersion: string;
    userId: string;
    nodeId: string;
    resolverOperation: string;

    snapshotTime?: string;
    snapshotData?: string;

    userRoles?: string[];
}

export interface IRevisionQueryResultWithTimeSecs {
    revisionId: string;
    revisionTime: number;
    revisionData: string;

    nodeName: string;
    nodeSchemaVersion: string;
    userId: string;
    nodeId: string;
    resolverOperation: string;

    snapshotTime?: string;
    snapshotData?: string;

    userRoles?: string[];
}

export interface ITransformInput {
    columnNames: NonNullable<INamesForTablesAndColumns['columnNames']> & {[column: string]: any};
    columnData: NonNullable<IRevisionInfo> & {[column: string]: any};
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
