import {Resolver, ITodoList} from '../types';

type UserTodosResolver = Resolver<Promise<ITodoList[] | undefined>, {id: string}>;

const user: {
    todos: UserTodosResolver;
} = {
    async todos({id: userId}, _, {sqlClient}) {
        const result = (await sqlClient
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
