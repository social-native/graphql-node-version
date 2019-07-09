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
import {Resolver} from './types';
import {decorate, IVersionSetupExtractors, createRevisionTransaction} from '../src/index';
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

interface IUserMutationInput {
    username: string;
    firstname: string;
}

type KnexQueryResult = Array<{[attributeName: string]: any}>;

const versioned = <ResolverT extends (...args: any[]) => any>(
    extractors: IVersionSetupExtractors<ResolverT>,
    revisionTx?: ReturnType<typeof createRevisionTransaction>
): MethodDecorator => {
    return (_target, _property, descriptor: TypedPropertyDescriptor<any>) => {
        const {value} = descriptor;
        if (typeof value !== 'function') {
            throw new TypeError('Only functions can be decorated.');
        }

        // tslint:disable-next-line
        descriptor.value = (async (...args) => {
            const localKnexClient =
                extractors.knex && extractors.knex(...(args as Parameters<ResolverT>));
            const userId =
                extractors.userId && extractors.userId(...(args as Parameters<ResolverT>));
            const userRoles =
                extractors.userRoles && extractors.userRoles(...(args as Parameters<ResolverT>));
            const revisionData =
                extractors.revisionData &&
                extractors.revisionData(...(args as Parameters<ResolverT>));
            const revisionTime =
                extractors.revisionTime &&
                extractors.revisionTime(...(args as Parameters<ResolverT>));
            const nodeVersion =
                extractors.nodeVersion &&
                extractors.nodeVersion(...(args as Parameters<ResolverT>));
            const nodeName =
                extractors.nodeName && extractors.nodeName(...(args as Parameters<ResolverT>));

            const revisionInput = {
                userId,
                userRoles,
                revisionData,
                revisionTime,
                nodeVersion,
                nodeName
            };

            const revTxFn = revisionTx ? revisionTx : createRevisionTransaction();
            const {transaction} = await revTxFn(localKnexClient, revisionInput);
            // await transaction.commit();
            // console.log(transaction);
            const [parent, ar, ctx, info] = args;
            const newArgs = {...ar, transaction};
            // console.log(revisionInput);
            return (await value(parent, newArgs, ctx, info)) as ReturnType<ResolverT>;
            // return result;
        }) as ResolverT;

        return descriptor;
    };
};
// Provide resolver functions for your schema fields
// tslint:disable

type UserResolver = Resolver<
    IUserNode,
    undefined,
    IUserMutationInput & {transaction?: knex.Transaction<any, any>}
>;

const mutation: {user: UserResolver} = {
    user: async (_, {firstname, username, transaction}) => {
        console.log('HERE', firstname, username);
        // const queryBuilder = knexClient.from('mock');
        if (transaction) {
            console.log('inside transaction block');
            // const t = transaction as any;
            // try {
            //     await queryBuilder
            //         .transacting(transaction)
            //         .from('mock')
            //         .insert({firstname, username});
            //     await transaction.commit();
            // } catch (e) {
            //     // await transaction.rollback();
            //     throw e;
            // }
        }
        return {firstname: 'hi', username: 'okay'} as IUserNode;
        // return (await queryBuilder.first()) as IUserNode;
    }
};

decorate(mutation, {
    user: versioned<UserResolver>({
        knex: () => knexClient,
        userId: () => '1',
        userRoles: () => '123',
        revisionTime: () =>
            new Date()
                .toISOString()
                .split('Z')
                .join(''),
        nodeName: () => 'user',
        nodeVersion: () => 1,
        revisionData: (_parent, args) => JSON.stringify(args)
    })
});

// tslint:enable

const resolvers = {
    Mutation: mutation,
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
