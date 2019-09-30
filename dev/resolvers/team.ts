import {IUserNode, Resolver} from '../types';
import knex from 'knex';

import {development as developmentConfig} from '../../knexfile.mysql';
const knexClient = knex(developmentConfig);

type TeamUsersResolver = Resolver<IUserNode[], {id: string}>;

const team: {
    users: TeamUsersResolver;
} = {
    async users({id: teamId}) {
        return (await knexClient
            .from('team_user')
            .leftJoin('user', 'user.id', 'team_user.user_id')
            .where({'team_user.team_id': teamId})) as IUserNode[];
    }
};

export default team;
