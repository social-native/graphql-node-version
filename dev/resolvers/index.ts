import {IResolvers} from 'apollo-server-koa';
import unixTimeSec from 'graphql-scalar-unix-time-sec';
import {resolvers as connectionResolvers} from 'graphql-connections';
import {resolvers as versionResolvers} from '../../src';

import Mutation from './mutation';
import Query from './query';
import Team from './team';
import User from './user';

export default {
    Mutation,
    Query,
    Team,
    User,
    ...connectionResolvers,
    ...unixTimeSec.resolver,
    ...versionResolvers
} as IResolvers;
