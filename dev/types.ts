import {GraphQLResolveInfo, GraphQLScalarType} from 'graphql';
import {MergeInfo} from 'graphql-tools';
import Koa from 'koa';
import {IAuthorizationContextService} from 'snpkg-snapi-authorization';

// reusable - shared by all services

type BaseResolverContext = Koa.Context;
type BaseResolverInfo = GraphQLResolveInfo & {mergeInfo: MergeInfo};
export type BaseResolver<Node = any, P = undefined, A = undefined, C = {}, I = {}> = (
    parent: P,
    args: A,
    ctx: C & BaseResolverContext,
    info?: I & BaseResolverInfo
) => Node | Promise<Node>;

export interface IResolvers {
    Query: IRootResolvers;
    [key: string]: IRootResolvers | GraphQLScalarType;
}

export interface IRootResolvers {
    [key: string]: Resolver<any, any, any> | IFragmentResolver<any, any, any>;
}

export interface IFragmentResolver<Node, P = undefined, A = undefined> {
    fragment: string;
    resolve: Resolver<Node, P, A>;
}

// specific - to this service

export type ResolverContext = {} & IAuthorizationContextService;

export type Resolver<Node, P = undefined, A = undefined> = BaseResolver<
    Node,
    P,
    A,
    ResolverContext
>;

export interface IAggregateInput {
    since?: number;
    until?: number;
}
