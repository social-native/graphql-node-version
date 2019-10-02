import {gql} from 'apollo-server-koa';
import unixTimeSec from '@social-native/snpkg-graphql-scalar-unix-time-sec';

export default gql`
    type User {
        id: ID
        username: String
        firstname: String
        lastname: String
        bio: String
        age: Int
        haircolor: String
        todos: [TodoList]
    }

    type QueryUserConnection implements IConnection {
        pageInfo: PageInfo!
        edges: [QueryUserEdge]
    }

    type QueryUserEdge implements IEdge {
        cursor: String!
        node: User
    }

    type QueryUserVersionConnection implements IConnection {
        pageInfo: PageInfo!
        edges: [QueryUserVersionEdge]!
    }

    type Version {
        userId: ID!
        userRoles: [String]!
        revisionId: ID!
        revisionData: String!
        revisionTime: ${unixTimeSec.type.name}!
        nodeSchemaVersion: ID!
        nodeName: String!
        resolverOperation: String!
    }

    type QueryUserVersionEdge implements IEdge {
        cursor: String!
        node: User
        version: Version
    }

    type Query {
        user(id: ID!): User
        userVersion(
            id: ID!
            first: First
            last: Last
            orderBy: OrderBy
            orderDir: OrderDir
            before: Before
            after: After
            filter: Filter
        ): QueryUserVersionConnection
        users(
            first: First
            last: Last
            orderBy: OrderBy
            orderDir: OrderDir
            before: Before
            after: After
            filter: Filter
            search: Search
        ): QueryUserConnection
        todoList(id: ID!): TodoList
        todoItem(id: ID!): TodoItem
        team(id: ID!): Team
    }

    type Mutation {
        teamCreate(
            name: String!
        ): CreationId
        teamUpdate(
            id: ID!
            name: String
        ): CreationId
        teamDelete(
            id: ID!
        ): CreationId
        teamUserCreate(
            userId: ID!
            teamId: ID!
        ): CreationId
        teamUserDelete(
            userId: ID!
            teamId: ID!
        ): CreationId
        todoListCreate(
            userId: ID!
            usage: String!
        ): CreationId
        todoListUpdate(
            id: ID!
            usage: String
        ): CreationId
        todoListDelete(
            id: ID!
        ): CreationId
        todoItemCreate(
            todoListId: ID!
            note: String!
            order: Int!
        ): CreationId
        todoItemUpdate(
            id: ID!
            note: String
            order: Int
        ): CreationId
        todoItemDelete(
            id: ID!
        ): CreationId
        userCreate(
            username: String!
            firstname: String!
            lastname: String
            bio: String
            age: Int
            haircolor: String
        ): User
        userUpdate(
            id: ID!
            username: String
            firstname: String
            lastname: String
            bio: String
            age: Int
            haircolor: String
        ): User
        userDelete(
            id: ID!
        ): CreationId
    }

    type Team {
        id: ID!
        name: String
        users: [User]
    }

    type TodoList {
        id: ID!
        usage: String
        items: [TodoItem]
    }

    type TodoItem {
        id: ID!
        order: Int
        note: String
    }

    type CreationId {
        id: ID!
    }

    ${unixTimeSec.typedef}
`;
