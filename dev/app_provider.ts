import {ApolloServer, gql} from 'apollo-server-koa';
import Koa from 'koa';
import Knex from 'knex';

import {typeDefs as connectionTypeDefs} from 'graphql-connections';
import unixTimeSec from 'graphql-scalar-unix-time-sec';

import appTypeDefs from './type_defs';
import resolvers from './resolvers';

import {typeDefs as versionTypeDefs} from '../src';

const allTypeDefs = gql`
    ${appTypeDefs}
    ${connectionTypeDefs}
    ${versionTypeDefs}
    ${unixTimeSec.typedef}
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
