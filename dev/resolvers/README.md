```graphql
mutation TeamCreate {
  teamCreate(name: "Blue birds") {
    id
  }
}

mutation TeamUpdate {
  teamUpdate(id: 1, name: "Blarblaster") {
    id
  }
}

mutation TeamDelete {
  teamDelete(id: 1) {
    id
  }
}

mutation UserCreate {
  userCreate(username: "berry", firstname: "butterface", lastname: "roll") {
    id
    username
    firstname
  }
}

mutation UserUpdate {
  userUpdate(id: 1, username: "what", firstname: "the", haircolor: "orange") {
    id
    username
    firstname
  }
}

mutation UserDelete {
  userDelete(id: 1) {
    id
  }
}

mutation TeamUserCreate {
  teamUserCreate(userId: 3, teamId: 3) {
    id
  }
}

mutation TeamUserDelete {
  teamUserDelete(userId: 1, teamId: 1) {
    id
  }
}

mutation TodoListCreate {
  todoListCreate(userId: 3, usage: "hi") {
    id
  }
}

mutation TodoListUpdate {
  todoListUpdate(id: 1, usage: "herror") {
    id
  }
}

mutation TodoListDelete {
  todoListDelete(id: 3) {
    id
  }
}

mutation TodoItemCreate {
  todoItemCreate(todoListId: 4, note: "hello", order: 35) {
    id
  }
}

mutation TodoItemUpdate {
  todoItemUpdate(id: 4, order: 1, note: "blue") {
    id
  }
}

mutation TodoItemDelete {
  todoItemDelete(id: 6) {
    id
  }
}

query TeamQuery {
  team(id: 3) {
    id
    name
    users {
      id
      username
      todos {
        id
        usage
        items {
          id
          note
          order
        }
      }
    }
  }
}
query TodoListQuery {
  todoList(id: 3) {
    id
    usage
    items {
      id
      note
      order
    }
  }
}

```