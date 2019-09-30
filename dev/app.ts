import {ApolloServer, gql} from 'apollo-server-koa';
import Koa from 'koa';

import {typeDefs as connectionTypeDefs} from '@social-native/snpkg-snapi-connections';

import typeDefs from './typeDefs';
import resolvers from './resolvers';

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
