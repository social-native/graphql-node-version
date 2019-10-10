import {IResolvers} from 'apollo-server-koa';
import unixTimeSec from '@social-native/snpkg-graphql-scalar-unix-time-sec';
import {resolvers as connectionResolvers} from '@social-native/snpkg-snapi-connections';

import Mutation from './mutation';
import Query from './query';
import Team from './team';
import User from './user';
// import TodoList from './todo_list';
import Version from './version';

export default {
    Version,
    Mutation,
    Query,
    Team,
    User,
    // TodoList,
    ...connectionResolvers,
    ...unixTimeSec.resolver
} as IResolvers;
