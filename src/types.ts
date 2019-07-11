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
        version: {
            userId?: string;
            userRoles?: string[];
            revisionData?: string;
            createdOn?: string;
            nodeVersion?: number;
            nodeName?: string;
            nodeId?: string | number;
        };
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
    tableNames?: {revision?: string; revisionRole?: string; revisionUserRole?: string};
    columnNames?: {
        userId?: string;
        userRoles?: string;
        revisionData?: string;
        revisionTime?: string;
        nodeVersion?: string;
        nodeName?: string;
        nodeId?: string;
        roleName?: string;
        resolverName?: string;
    };
}

export interface INamesForTablesAndColumns {
    tableNames: Required<INamesConfig['tableNames']>;
    columnNames: Required<INamesConfig['columnNames']>;
}

export type UnPromisify<T> = T extends Promise<infer U> ? U : T;

export interface IRevisionInfo {
    userId: string;
    userRoles?: string[];
    revisionData: string;
    revisionTime?: string;
    nodeVersion: number;
    nodeName: string;
    nodeId?: string | number;
    resolverName?: string;
}

export interface ITransformInput {
    columnNames: NonNullable<INamesForTablesAndColumns['columnNames']> & {[column: string]: any};
    columnData: NonNullable<IRevisionInfo> & {[column: string]: any};
}
