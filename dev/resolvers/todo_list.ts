import {Resolver, ITodoItem} from '../types';

type TodoListTodoItemsResolver = Resolver<ITodoItem[], {id: string}>;

const todoList: {
    items: TodoListTodoItemsResolver;
} = {
    async items({id: todoListId}, _, {sqlClient}) {
        const result = (await sqlClient
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
