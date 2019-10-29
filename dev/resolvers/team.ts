import {IUserNode, Resolver} from '../types';

type TeamUsersResolver = Resolver<Promise<IUserNode[] | undefined>, {id: string}>;

const team: {
    users: TeamUsersResolver;
} = {
    async users({id: teamId}, _, {sqlClient}) {
        return (await sqlClient
            .from('team_user')
            .leftJoin('user', 'user.id', 'team_user.user_id')
            .where({'team_user.team_id': teamId})) as IUserNode[];
    }
};

export default team;
