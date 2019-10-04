import {Resolver, IUserNode, ITodoItem, ITodoList} from '../types';
import {ConnectionManager, IInputArgs, IQueryResult} from '@social-native/snpkg-snapi-connections';

import {
    // decorate,
    // versionConnectionDecorator as versionConnection,
    INodeBuilderRevisionInfo,
    IVersionConnection,
    createRevisionConnection
} from '../../src/index';

interface ITeam {
    id: number;
    name: string;
}

type QueryTeamResolver = Resolver<
    IVersionConnection<ITeam | null>,
    undefined,
    {id: string} & IInputArgs
>;
type QueryTodoListResolver = Resolver<
    IVersionConnection<ITodoList | undefined>,
    undefined,
    {id: string} & IInputArgs
>;
type QueryTodoItemResolver = Resolver<
    IVersionConnection<ITodoItem | undefined>,
    undefined,
    {id: string} & IInputArgs
>;
type QueryUsersResolver = Resolver<IQueryResult<IUserNode | null>, undefined, IInputArgs>;
// type QueryUserResolver = Resolver<IUserNode, undefined, {id: string}>;
type QueryUserResolver = Resolver<
    IVersionConnection<IUserNode | null>,
    undefined,
    {id: string} & IInputArgs
>;

type KnexQueryResult = Array<{[attributeName: string]: any}>;

const query: {
    team: QueryTeamResolver;
    todoList: QueryTodoListResolver;
    todoItem: QueryTodoItemResolver;
    user: QueryUserResolver;
    users: QueryUsersResolver;
} = {
    async team(parent, args, ctx, info) {
        const currentNode = (await ctx.sqlClient
            .from('team')
            .where({id: args.id})
            .first()) as {id: number; name: string};

        return await createRevisionConnection(currentNode, [parent, args, ctx, info], {
            knex: ctx.sqlClient,
            nodeBuilder,
            nodeId: args.id,
            nodeName: 'team'
        });
    },
    async todoList(parent, args, ctx, info) {
        const currentNode = await ctx.sqlClient
            .from('todo_list')
            .where({'todo_list.id': args.id})
            .first();

        return await createRevisionConnection(currentNode, [parent, args, ctx, info], {
            knex: ctx.sqlClient,
            nodeBuilder,
            nodeId: args.id,
            nodeName: 'todoList'
        });
    },
    async todoItem(parent, args, ctx, info) {
        const currentNode = await ctx.sqlClient
            .from('todo_item')
            .where({id: args.id})
            .first();

        return await createRevisionConnection(currentNode, [parent, args, ctx, info], {
            knex: ctx.sqlClient,
            nodeBuilder,
            nodeId: args.id,
            nodeName: 'todoItem'
        });
    },
    async user(parent, args, ctx, info) {
        const currentNode = await ctx.sqlClient
            .table('user')
            .where({id: args.id})
            .first();

        return await createRevisionConnection(currentNode, [parent, args, ctx, info], {
            knex: ctx.sqlClient,
            nodeBuilder,
            nodeId: args.id,
            nodeName: 'user'
        });
    },
    async users(_, inputArgs, {sqlClient}) {
        const queryBuilder = sqlClient.from('user');
        // maps node types to sql column names
        const attributeMap = {
            id: 'id',
            username: 'username',
            firstname: 'firstname',
            age: 'age',
            haircolor: 'haircolor',
            lastname: 'lastname',
            bio: 'bio'
        };

        const builderOptions = {
            searchColumns: ['username', 'firstname', 'lastname', 'bio', 'haircolor'],
            searchModifier: 'IN NATURAL LANGUAGE MODE'
        };
        const nodeConnection = new ConnectionManager<IUserNode>(inputArgs, attributeMap, {
            builderOptions
        });

        const queryResult = nodeConnection.createQuery(queryBuilder.clone()).select();
        const result = (await queryResult) as KnexQueryResult;

        nodeConnection.addResult(result);

        return {
            pageInfo: nodeConnection.pageInfo,
            edges: nodeConnection.edges
        };
    }
};

// const proxiedResolvers: {
//     userVersion: QueryUserVersionResolver;
// } = {
//     async userVersion(parent, args, ctx, info) {
//         const currentNode = query.user(parent, {id: args.id}, ctx, info);
//         return await createRevisionConnection(currentNode, [parent, args, ctx, info], {
//             knex: ctx.sqlClient,
//             nodeBuilder,
//             nodeId: args.id,
//             nodeName: 'user'
//         });
//     }
// };

const nodeBuilder = (previousModel: object, revisionInfo: INodeBuilderRevisionInfo) => {
    const {revisionData} = revisionInfo;
    // TODO figure out why this is an object
    const data = revisionData as any;
    return {...previousModel, ...data};
};

// decorate(query, {
//     user: versionConnection<QueryUserResolver>({
//         knex: (_, __, {sqlClient}) => sqlClient,
//         nodeBuilder,
//         nodeId: (_parent, {id}) => id,
//         nodeName: () => 'user'
//     })
// });

// export default {...query, ...proxiedResolvers};
export default query;
