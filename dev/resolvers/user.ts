import {Resolver, ITodoList} from '../types';
import knex from 'knex';

import {development as developmentConfig} from '../../knexfile.mysql';
const knexClient = knex(developmentConfig);

type UserTodosResolver = Resolver<ITodoList[] | undefined, {id: string}>;

const user: {
    todos: UserTodosResolver;
} = {
    async todos({id: userId}) {
        const result = (await knexClient
            .from('todo_list')
            .leftJoin('user_todo_list', 'user_todo_list.todo_list_id', 'todo_list.id')
            .where({'user_todo_list.user_id': userId})
            .select('todo_list.id as id', 'usage')) as Array<{
            id: number;
            usage: string;
        }>;
        if (result.length > 0) {
            return result;
        }
        return undefined;
    }
};

export default user;
