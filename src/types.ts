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
            revisionTime?: string;
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
