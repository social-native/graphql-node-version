import {ApolloServer, gql} from 'apollo-server-koa';
import Koa from 'koa';
import Knex from 'knex';

import {typeDefs as connectionTypeDefs} from '@social-native/snpkg-snapi-connections';

import typeDefs from './type_defs';
import resolvers from './resolvers';

const allTypeDefs = gql`
    ${typeDefs}
    ${connectionTypeDefs}
`;

const provider = (knex: Knex) => {
    const server = new ApolloServer({
        typeDefs: allTypeDefs,
        resolvers,
        context: ctx => {
            ctx.sqlClient = knex;
            return ctx;
        }
    });
    const app = new Koa();

    server.applyMiddleware({app});

    app.listen({port: 4000}, () =>
        // tslint:disable-next-line
        console.log(
            `🚀 Server ready at http://localhost:4000${server.graphqlPath} (PID: ${process.pid})`
        )
    );
};

export default provider;
