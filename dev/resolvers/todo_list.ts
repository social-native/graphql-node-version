import {Resolver, ITodoItem} from '../types';
import knex from 'knex';

import {development as developmentConfig} from '../../knexfile.mysql';
const knexClient = knex(developmentConfig);

type TodoListTodoItemsResolver = Resolver<ITodoItem[], {id: string}>;

const todoList: {
    items: TodoListTodoItemsResolver;
} = {
    async items({id: todoListId}) {
        const result = (await knexClient
            .from('todo_item')
            .where({'todo_item.todo_list_id': todoListId})
            .select('id', 'note', 'order')) as Array<{
            id: number;
            note: string;
            order: number;
        }>;
        return result;
    }
};

export default todoList;
