import Koa from 'koa';
import {ApolloServer, gql, IResolvers} from 'apollo-server-koa';
import knex from 'knex';
import {
    ConnectionManager,
    IInputArgs,
    typeDefs as connectionTypeDefs,
    resolvers as connectionResolvers
} from 'snpkg-snapi-connections';

import {development as developmentConfig} from '../knexfile.mysql';
import {decorate} from '../src/index';
const knexClient = knex(developmentConfig);

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

    type Query {
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
        user(username: String, firstname: String): User
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

type KnexQueryResult = Array<{[attributeName: string]: any}>;

function hi() {
    console.log('f(): evaluated');
    return function(_target: any, _propertyKey: string, _descriptor: PropertyDescriptor) {
        console.log('f(): called');
    };
}
// Provide resolver functions for your schema fields
// tslint:disable
const mutation = {
    user(_: any, {firstname, username}: IUserNode) {
        console.log('HERE', firstname, username);
    }
};

const decoratedMutation = decorate(mutation, {
    user: hi
});
// tslint:enable

const resolvers = {
    Mutation: decoratedMutation,
    Query: {
        async users(_: any, inputArgs: IInputArgs) {
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

            const query = nodeConnection.createQuery(queryBuilder.clone()).select();
            const result = (await query) as KnexQueryResult;

            nodeConnection.addResult(result);

            return {
                pageInfo: nodeConnection.pageInfo,
                edges: nodeConnection.edges
            };
        }
    },
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
