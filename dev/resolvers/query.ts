import {Resolver, IUserNode, ITodoItem, ITodoList} from '../types';
import {ConnectionManager, IInputArgs, IQueryResult} from '@social-native/snpkg-snapi-connections';

import {
    // decorate,
    // versionConnectionDecorator as versionConnection,
    INodeBuilderRevisionInfo,
    IRevisionConnection,
    createRevisionConnection
} from '../../src/index';

interface ITeam {
    id: number;
    name: string;
}

type QueryTeamResolver = Resolver<
    IRevisionConnection<ITeam | null>,
    undefined,
    {id: string} & IInputArgs
>;
type QueryTodoListResolver = Resolver<ITodoList | undefined, undefined, {id: string}>;
type QueryTodoItemResolver = Resolver<ITodoItem, undefined, {id: string}>;
type QueryUsersResolver = Resolver<IQueryResult<IUserNode | null>, undefined, IInputArgs>;
// type QueryUserResolver = Resolver<IUserNode, undefined, {id: string}>;
type QueryUserResolver = Resolver<
    IRevisionConnection<IUserNode | null>,
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
    async todoList(_, {id}, {sqlClient}) {
        const result = (await sqlClient
            .from('todo_list')
            .leftJoin('todo_item', 'todo_item.todo_list_id', 'todo_list.id')
            .where({'todo_list.id': id})
            .select(
                'todo_list.id as id',
                'todo_item.id as todoItemId',
                'usage',
                'note',
                'order'
            )) as Array<{
            id: number;
            todoItemId: number;
            usage: string;
            note: string;
            order: number;
        }>;
        if (result.length > 0) {
            const {usage, id: listId} = result[0];
            return {
                id: listId,
                usage,
                items: result.filter(r => r.note).map(r => ({...r, id: r.todoItemId}))
            };
        }
        return undefined;
    },
    async todoItem(_, {id}, {sqlClient}) {
        return await sqlClient
            .from('todo_item')
            .where({id})
            .first();
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
