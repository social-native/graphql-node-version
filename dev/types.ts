import {GraphQLResolveInfo, GraphQLScalarType} from 'graphql';
import {MergeInfo} from 'graphql-tools';
import Koa from 'koa';
import Knex from 'knex';
import {IAuthorizationContextService} from '@social-native/snpkg-snapi-authorization';

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
export interface ISqlClient {
    sqlClient: Knex;
}
export type ResolverContext = {} & IAuthorizationContextService & ISqlClient;

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

export interface IUserNode {
    id: number;
    username: string;
    firstname: string;
    lastname: string;
    age: number;
    haircolor: string;
    bio: string;
}

export interface ITodoList {
    id: number;
    usage: string;
}

export interface ITodoItem {
    id: number;
    order: number;
    note: string;
}
