import Koa from 'koa';
import {ApolloServer, gql, IResolvers} from 'apollo-server-koa';
// import {getSqlDialectTranslator} from '@social-native/snpkg-snapi-ndm';

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
    IRevisionInfo,
    IRevisionConnection
} from '../src/index';
const knexClient = knex(developmentConfig);

// const getTxInsertId = async (k: knex, tx: knex.Transaction) => {
//     const sqlTranslator = getSqlDialectTranslator(k);

//     const {id} = await tx
//         .select(tx.raw(`${sqlTranslator.lastInsertedId} as id`))
//         .forUpdate()
//         .first<{id: number | undefined}>();
//     return id;
// };

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
        revisionData: String!
        revisionTime: String!
        nodeSchemaVersion: Int!
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
    }
    type Mutation {
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
`;

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

type QueryUsersResolver = Resolver<IQueryResult<IUserNode | null>, undefined, IInputArgs>;
type QueryUserResolver = Resolver<IUserNode, undefined, {id: string}>;

const mutation: {userCreate: MutationUserCreateResolver; userUpdate: MutationUserUpdateResolver} = {
    userCreate: async (_, {transaction, ...input}) => {
        const tx = transaction || (await knexClient.transaction());
        try {
            await tx.table('mock').insert(input);
            const user = await tx
                .table('mock')
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
                .table('mock')
                .update(input)
                .where({id});
            const user = await tx
                .table('mock')
                .where({id})
                .first();
            // .orderBy('id', 'desc')
            // .first();
            await tx.commit();
            console.log('I AM YOUR USER', user);
            return user as IUserNode;
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    }
};

const query: {user: QueryUserResolver; users: QueryUsersResolver} = {
    async user(_, {id}) {
        const queryBuilder = knexClient.from('mock');
        return await queryBuilder
            .table('mock')
            .where({id})
            .first();
    },
    async users(_, inputArgs) {
        const queryBuilder = knexClient.from('mock');
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
        userRoles: () => ['operations', 'user', 'billing'],
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

const nodeBuilder = (previousModel: object, revisionInfo: Partial<IRevisionInfo>) => {
    const {revisionData} = revisionInfo;
    // TODO figure out why this is an object
    const data = revisionData as any;
    return {...previousModel, ...data};
};

decorate(query, {
    user: versionConnection<QueryUserResolver>({
        knex: () => knexClient,
        nodeBuilder
    })
});

// tslint:enable

const resolvers = {
    Mutation: mutation,
    Query: query,
    ...connectionResolvers
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
