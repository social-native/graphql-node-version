import Koa from 'koa';
import {ApolloServer, gql, IResolvers} from 'apollo-server-koa';
// import {getSqlDialectTranslator} from '@social-native/snpkg-snapi-ndm';
import unixTimeSec from '@social-native/snpkg-graphql-scalar-unix-time-sec';
import {getSqlDialectTranslator} from '@social-native/snpkg-snapi-ndm';

import knex from 'knex';
import {
    ConnectionManager,
    IInputArgs,
    typeDefs as connectionTypeDefs,
    resolvers as connectionResolvers,
    IQueryResult
} from '@social-native/snpkg-snapi-connections';

import {development as developmentConfig} from '../knexfile.mysql';
import {Resolver} from './types';
import {
    decorate,
    versionRecorderDecorator as versionRecorder,
    versionConnectionDecorator as versionConnection,
    IRevisionConnection,
    INodeBuilderRevisionInfo
} from '../src/index';
const knexClient = knex(developmentConfig);

export const getTxInsertId = async (k: knex, tx: knex.Transaction) => {
    const sqlTranslator = getSqlDialectTranslator(k);

    const {id} = await tx
        .select(tx.raw(`${sqlTranslator.lastInsertedId} as id`))
        .forUpdate()
        .first<{id: number | undefined}>();
    return id;
};
// Construct a schema, using GraphQL schema language
const typeDefs = gql`
    type User {
        id: ID
        username: String
        firstname: String
        lastname: String
        bio: String
        age: Int
        haircolor: String
    }

    type QueryUserConnection implements IConnection {
        pageInfo: PageInfo!
        edges: [QueryUserEdge]
    }

    type QueryUserEdge implements IEdge {
        cursor: String!
        node: User
    }

    type QueryUserVersionConnection implements IConnection {
        pageInfo: PageInfo!
        edges: [QueryUserVersionEdge]!
    }

    type Version {
        userId: ID!
        userRoles: [String]!
        revisionId: ID!
        revisionData: String!
        revisionTime: ${unixTimeSec.type.name}!
        nodeSchemaVersion: ID!
        nodeName: String!
        resolverName: String!
    }

    type QueryUserVersionEdge implements IEdge {
        cursor: String!
        node: User
        version: Version
    }

    type Query {
        user(
            id: ID!
            first: First
            last: Last
            orderBy: OrderBy
            orderDir: OrderDir
            before: Before
            after: After
            filter: Filter
        ): QueryUserVersionConnection
        users(
            first: First
            last: Last
            orderBy: OrderBy
            orderDir: OrderDir
            before: Before
            after: After
            filter: Filter
            search: Search
        ): QueryUserConnection
        todoList(id: ID!): TodoList
        todoItem(id: ID!): TodoItem
    }
    type Mutation {
        todoListCreate(
            userId: ID!
            usage: String!
        ): CreationId
        todoItemCreate(
            todoListId: ID!
            note: String!
            order: Int!
        ): CreationId
        userCreate(
            username: String!
            firstname: String!
            lastname: String
            bio: String
            age: Int
            haircolor: String
        ): User
        userUpdate(
            id: ID!
            username: String
            firstname: String
            lastname: String
            bio: String
            age: Int
            haircolor: String
        ): User
    }

    type TodoList {
        id: ID!
        usage: String
        items: [TodoItem]
    }

    type TodoItem {
        id: ID!
        order: Int
        note: String
    }

    type CreationId {
        id: ID!
    }

    ${unixTimeSec.typedef}
`;

interface ITodoItem {
    id: number;
    order: number;
    note: string;
}

interface ITodoList {
    id: number;
    usage: string;
    items: ITodoItem[];
}

interface ITodoListCreationMutationInput {
    userId: number;
    usage: string;
}

interface ITodoItemCreationMutationInput {
    todoListId: number;
    note: string;
    order: number;
}

interface IUserNode {
    id: number;
    username: string;
    firstname: string;
    lastname: string;
    age: number;
    haircolor: string;
    bio: string;
}

interface IUserCreationMutationInput {
    username: string;
    firstname: string;
    lastname?: string;
    age?: number;
    haircolor?: string;
    bio?: string;
}

interface IUserUpdateMutationInput {
    id: string;
    username?: string;
    firstname?: string;
    lastname?: string;
    age?: number;
    haircolor?: string;
    bio?: string;
}

type KnexQueryResult = Array<{[attributeName: string]: any}>;

type MutationTodoListCreate = Resolver<
    {id: number | undefined},
    undefined,
    ITodoListCreationMutationInput & {transaction?: knex.Transaction<any, any>}
>;
type MutationTodoItemCreate = Resolver<
    {id: number | undefined},
    undefined,
    ITodoItemCreationMutationInput & {transaction?: knex.Transaction<any, any>}
>;
type MutationUserCreateResolver = Resolver<
    IUserNode,
    undefined,
    IUserCreationMutationInput & {transaction?: knex.Transaction<any, any>}
>;
type MutationUserUpdateResolver = Resolver<
    IUserNode,
    undefined,
    IUserUpdateMutationInput & {transaction?: knex.Transaction<any, any>}
>;

type QueryTodoListResolver = Resolver<ITodoList | undefined, undefined, {id: string}>;
type QueryTodoItemResolver = Resolver<ITodoItem, undefined, {id: string}>;
type QueryUsersResolver = Resolver<IQueryResult<IUserNode | null>, undefined, IInputArgs>;
type QueryUserResolver = Resolver<IUserNode, undefined, {id: string}>;

const mutation: {
    todoListCreate: MutationTodoListCreate;
    todoItemCreate: MutationTodoItemCreate;
    userCreate: MutationUserCreateResolver;
    userUpdate: MutationUserUpdateResolver;
} = {
    todoListCreate: async (_, {transaction, usage, userId}) => {
        const tx = transaction || (await knexClient.transaction());
        try {
            await tx.table('todo_list').insert({usage});
            const todoListId = await getTxInsertId(knexClient, tx);
            await tx.table('user_todo_list').insert({user_id: userId, todo_list_id: todoListId});
            await tx.commit();
            return {id: todoListId};
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },
    todoItemCreate: async (_, {transaction, todoListId, order, note}) => {
        const tx = transaction || (await knexClient.transaction());
        try {
            await tx.table('todo_item').insert({order, note, todo_list_id: todoListId});
            const todoItemId = await getTxInsertId(knexClient, tx);
            await tx.commit();
            return {id: todoItemId};
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },
    userCreate: async (_, {transaction, ...input}) => {
        const tx = transaction || (await knexClient.transaction());
        try {
            await tx.table('user').insert(input);
            const user = await tx
                .table('user')
                .orderBy('id', 'desc')
                .first();
            await tx.commit();
            return user as IUserNode;
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },
    userUpdate: async (_, {id, transaction, ...input}) => {
        const tx = transaction || (await knexClient.transaction());
        try {
            await tx
                .table('user')
                .update(input)
                .where({id});
            const user = await tx
                .table('user')
                .where({id})
                .first();
            // .orderBy('id', 'desc')
            // .first();
            await tx.commit();
            // console.log('I AM YOUR USER', user);
            return user as IUserNode;
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    }
};

const query: {
    todoList: QueryTodoListResolver;
    todoItem: QueryTodoItemResolver;
    user: QueryUserResolver;
    users: QueryUsersResolver;
} = {
    async todoList(_, {id}) {
        const result = (await knexClient
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
        console.log('INSIDEEEE', result);
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
    async todoItem(_, {id}) {
        return await knexClient
            .from('todo_item')
            .where({id})
            .first();
    },
    async user(_, {id}) {
        const queryBuilder = knexClient.from('user');
        return await queryBuilder
            .table('user')
            .where({id})
            .first();
    },
    async users(_, inputArgs) {
        const queryBuilder = knexClient.from('user');
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

decorate(mutation, {
    // TODO add ability to differentiate between additions and deletions in revision data
    userCreate: versionRecorder<MutationUserCreateResolver>({
        knex: () => knexClient,
        userId: () => '1',
        userRoles: () => ['operations', 'user', 'billing'],
        nodeIdCreate: ({id}) => id,
        nodeSchemaVersion: () => 1,
        revisionData: (_parent, args) => JSON.stringify(args),
        resolverName: () => 'create',
        nodeName: () => 'user',
        currentNodeSnapshot: async (nodeId, args) => {
            // TODO remind users in readme that the resolver type changes and
            // they need to cast it to IRevisionConnection<Node>
            const r = ((await query.user(
                undefined,
                {id: nodeId as string},
                args[2],
                args[3]
            )) as unknown) as IRevisionConnection<typeof query.user>;
            console.log('rrrrr', r);
            // todo undo when connection is returning right type
            return r;
            // return r.edges[0] ? r.edges[0].node : undefined;
        }
    }),
    userUpdate: versionRecorder<MutationUserUpdateResolver>({
        knex: () => knexClient,
        userId: () => '1',
        userRoles: () => ['operations', 'user', 'tester'],
        nodeIdUpdate: (_, {id}) => id,
        nodeSchemaVersion: () => 1,
        revisionData: (_parent, args) => JSON.stringify(args),
        resolverName: () => 'update',
        nodeName: () => 'user',
        currentNodeSnapshot: async (nodeId, args) => {
            // TODO remind users in readme that the resolver type changes and
            // they need to cast it to IRevisionConnection<Node>
            const r = ((await query.user(
                undefined,
                {id: nodeId as string},
                args[2],
                args[3]
            )) as unknown) as IRevisionConnection<typeof query.user>;
            console.log('rrrrr', r);
            // todo undo when connection is returning right type
            return r;
            // return r.edges[0] ? r.edges[0].node : undefined;
        },
        currentNodeSnapshotFrequency: 5
    })
});

const nodeBuilder = (previousModel: object, revisionInfo: INodeBuilderRevisionInfo) => {
    const {revisionData} = revisionInfo;
    // TODO figure out why this is an object
    const data = revisionData as any;
    return {...previousModel, ...data};
};

decorate(query, {
    user: versionConnection<QueryUserResolver>({
        knex: () => knexClient,
        nodeBuilder,
        nodeId: (_parent, {id}) => id,
        nodeName: () => 'user'
    })
});

// tslint:enable

const resolvers = {
    Mutation: mutation,
    Query: query,
    ...connectionResolvers,
    ...unixTimeSec.resolver
} as IResolvers;

const allTypeDefs = gql`
    ${typeDefs}
    ${connectionTypeDefs}
`;
const server = new ApolloServer({
    typeDefs: allTypeDefs,
    resolvers
});
const app = new Koa();
server.applyMiddleware({app});

app.listen({port: 4000}, () =>
    // tslint:disable-next-line
    console.log(
        `🚀 Server ready at http://localhost:4000${server.graphqlPath} (PID: ${process.pid})`
    )
);
