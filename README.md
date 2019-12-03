# snpkg-snapi-graphql-node-version :twisted_rightwards_arrows:


- [snpkg-snapi-graphql-node-version :twisted_rightwards_arrows:](#snpkg-snapi-graphql-node-version-twistedrightwardsarrows)
  - [Install](#install)
    - [Download](#download)
    - [Peer Dependencies](#peer-dependencies)
    - [Migrations](#migrations)
  - [Guide: Versioning a node](#guide-versioning-a-node)
    - [Configuration](#configuration)
      - [NODE_NAMES](#nodenames)
      - [RESOLVER_OPERATION](#resolveroperation)
      - [versionRecorder and versionConnection instances](#versionrecorder-and-versionconnection-instances)
      - [Common versionRecorder configuration](#common-versionrecorder-configuration)
    - [Version recording](#version-recording)
      - [1. Import the `versionRecord` instance](#1-import-the-versionrecord-instance)
      - [2. Define common configuration for each node type:](#2-define-common-configuration-for-each-node-type)
      - [3. For each mutation resolver, decorate it](#3-for-each-mutation-resolver-decorate-it)
    - [Version querying](#version-querying)
  - [API](#api)
    - [VersionRecorder](#versionrecorder)
    - [VersionConnection](#versionconnection)
  - [GQL Example Usage](#gql-example-usage)


## Install

### Download

```
npm install --save @social-native/snpkg-snapi-graphql-node-version
```

### Peer Dependencies

In order for this library to work you will need to install the following peer dependencies:

```json
{
  "@social-native/snpkg-dependency-check": "^0.1.0",
  "@social-native/snpkg-generate-config-ci": "^0.2.0",
  "@social-native/snpkg-graphql-scalar-unix-time-sec": "^0.1.0",
  "@social-native/snpkg-knex-migration-generator": "^0.1.3",
  "@social-native/snpkg-package-version-validation": "^3.3.1",
  "@social-native/snpkg-snapi-connections": "^5.0.1",
  "@social-native/snpkg-snapi-ndm": "^1.3.3",
  "bluebird": "^3.7.0",
  "knex": "^0.19.4",
  "luxon": "^1.19.3",
  "pino": "^5.13.4",
  "yargs": "^13.2.4"
}
```

### Migrations

This package installs knex migrations into the dependent service. A binary is published that you can call to add the migrations. For example, you can add this to your npm scripts:

```typescript
    scripts: {
        "add-version-migrations": "ts-node --project tsconfig.json node_modules/.bin/snpkg-snapi-graphql-node-version --knexfile knexfile.js",
        ...
        "post-install": "npm run add-version-migrations"
    },
```

> Note: In order for this to work, you need to have a `knexfile.js` in the root of the repo. If you are using a `snapi` service, you can generate a knex file use [snpkg-snapi-clients](https://github.com/social-native/snpkg-snapi-clients) to generate a kenx file.

## Guide: Versioning a node

### Configuration

In the `src` folder create a `src/version.ts` file. This file is used to keep track of `NODE_NAME` and `RESOLVER_OPERATION` enums and the instantialized `versionRecorder` and `versionConnection` class.

#### NODE_NAMES

Versions are recorded for each node instance. A node instance contains an `id` and a `name`. The names of all nodes should be stored in an enum called `NODE_NAME`.

For example:

```typescript
export enum NODE_NAME {
    DIRECTION_TREE = 'DIRECTION_TREE',
    PRODUCTION_TREE_NODE = 'PRODUCTION_TREE_NODE'
}
```

#### RESOLVER_OPERATION

Resolvers operate on node instances. Common operations are `CREATE`, `UPDATE`, `DELETE`, but there might be more specific ones if your node represents a tree. List all the node operations in an enum called `RESOLVER_OPERATION`.

For example:

```typescript
export enum DIRECTION_TREE_RESOLVER_OPERATION {
    CREATE_FULL_TREE = 'CREATE_FULL_TREE',
    UPDATE_RULE = 'UPDATE_RULE',
    UPDATE_BRANCH = 'UPDATE_BRANCH',
    UPDATE_CONNECTIVE = 'UPDATE_CONNECTIVE',
    DELETE_FULL_TREE = 'DELETE_FULL_TREE',
    DELETE_BRANCH = 'DELETE_BRANCH'
}
```

#### versionRecorder and versionConnection instances

You will use these instances in decorators or directly in resolvers to version a node. 

A common setup is to just pass the microservices logger to the class constructor, for example:

```typescript
import logger from 'logger';

export const versionRecorder = VersionRecorder({
    logger
    // logOptions: {
    //     level: 'info' // enable and remove `logger` to create a new logger with this log level
    // }
});

export const versionConnection = VersionConnection({
    logger
    // logOptions: {
    //     level: 'info' // enable and remove `logger` to create a new logger with this log level
    // }
});
```

If you wanted more specific logging you could enable debug logging, in which case the class would generate a pino logger instance internally:

```typescript
export const versionRecorder = VersionRecorder({
    logOptions: {
        level: 'debug'
    }
});

export const versionConnection = VersionConnection({
    logOptions: {
        level: 'debug'
    }
});
```

#### Common versionRecorder configuration

`versionRecorder` requires information in order to successfully map inputs and output to version information. For `snapi` services, the common configuration describes how to:

- get access to the `kenx` client
- extract the `userId`
- extract the `userRoles`

```typescript
export const commonVersionRecorderDecoratorConfig = <T extends Resolver<any, any, any>>() =>
    ({
        knex: (_, __, {clients}) => clients.sqlClient.connection,
        userId: (_, __, {user}) => {
            if (user) {
                if (!user.app_user_id) {
                    throw new Error('Missing user id');
                }
                return user.app_user_id.toString();
            } else {
                throw Error('Missing user');
            }
        },
        userRoles: (_, __, {user}) => {
            if (user) {
                return user.roles;
            } else {
                throw Error('Missing user');
            }
        }
    } as Pick<IVersionRecorderExtractors<T>, 'knex' | 'userId' | 'userRoles'>);

```

### Version recording

Capturing version information works by decorating mutation nodes and intercepting the mutation inputs and result.

You will need to provide the decorate with mapping functions or fields for each node. At a minimum, you need to provide:

- `revisionData`
- `nodeName`
- `currentNodeSnapshotFrequency`
- `currentNodeSnapshot`
- `nodeSchemaVersion`
- `nodeId`
- `resolverOperation`

#### 1. Import the `versionRecord` instance

```typescript
# src/resolvers/mutation/index.ts

import {
    NODE_NAME,
    versionRecorder,
    RESOLVER_OPERATION,
    commonVersionRecorderDecoratorConfig
} from 'version';
```

#### 2. Define common configuration for each node type:

```typescript
const productionTreeConfig = <T extends Resolver<any, any, any>>() =>
    ({
        revisionData: (_, args) => args,
        nodeName: NODE_NAME.PRODUCTION_TREE,
        currentNodeSnapshotFrequency: 1, <----- how often a full node snapshot should be stored
        currentNodeSnapshot: async (nodeId, args) => {   <------ a function to get a full node snapshot
            const conn = await query.productionTree(
                undefined,
                {productionId: nodeId as string},
                args[2],
                args[3]
            );
            return conn.edges[0].node; <---- note that this is extracting the node from a version connection
        },
        nodeSchemaVersion: 1 <----- the schema version of this node
    } as Pick<
        IVersionRecorderExtractors<T>,
        | 'revisionData'
        | 'nodeName'
        | 'currentNodeSnapshotFrequency'
        | 'currentNodeSnapshot'
        | 'nodeSchemaVersion'
    >);
```

#### 3. For each mutation resolver, decorate it

For example:

```typescript
decorate(mutation, {
    productionTreeCreate: versionRecorder<ProductionTreeCreate>({
        ...commonVersionRecorderDecoratorConfig<ProductionTreeCreate>(),
        ...productionTreeConfig<ProductionTreeCreate>(),
        resolverOperation: RESOLVER_OPERATION.CREATE,
        nodeId: node => node.createdNodeId,
        edges: (_node, _parent, {productionId}) => [
            {nodeId: productionId, nodeName: NODE_NAME.PRODUCTION}
        ]
    }),
    productionTreeBranchCreate: versionRecorder<ProductionTreeBranchCreate>({
        ...commonVersionRecorderDecoratorConfig<ProductionTreeBranchCreate>(),
        ...productionTreeConfig<ProductionTreeBranchCreate>(),
        resolverOperation: RESOLVER_OPERATION.CREATE_BRANCH,
        nodeId: node => node.updatedNodeId
    }),
    productionTreeNodeUpdate: versionRecorder<ProductionTreeNodeUpdate>({
        ...commonVersionRecorderDecoratorConfig<ProductionTreeNodeUpdate>(),
        ...productionTreeConfig<ProductionTreeNodeUpdate>(),
        resolverOperation: RESOLVER_OPERATION.UPDATE_NODE,
        nodeId: node => node.updatedNodeId
    }),
    productionTreeBranchUpdate: versionRecorder<ProductionTreeBranchUpdate>({
        ...commonVersionRecorderDecoratorConfig<ProductionTreeBranchUpdate>(),
        ...productionTreeConfig<ProductionTreeBranchUpdate>(),
        resolverOperation: RESOLVER_OPERATION.UPDATE_BRANCH,
        nodeId: node => node.updatedNodeId
    }),
    productionTreeBranchDelete: versionRecorder<ProductionTreeBranchUpdate>({
        ...commonVersionRecorderDecoratorConfig<ProductionTreeBranchUpdate>(),
        ...productionTreeConfig<ProductionTreeBranchUpdate>(),
        resolverOperation: RESOLVER_OPERATION.DELETE_BRANCH,
        nodeId: node => node.updatedNodeId
    }),
    productionTreeDelete: versionRecorder<ProductionTreeBranchUpdate>({
        ...commonVersionRecorderDecoratorConfig<ProductionTreeBranchUpdate>(),
        ...productionTreeConfig<ProductionTreeBranchUpdate>(),
        resolverOperation: RESOLVER_OPERATION.DELETE,
        nodeId: node => node.updatedNodeId
    })

```

### Version querying

Versions queries return a `versionConnection`

This has the type:

```typescript
export interface IVersionConnection<Node> {
    edges: Array<{
        cursor: string;
        version?: IGqlVersionNode;
        node?: Node;
    }>;
    pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor: string;
        endCursor: string;
    };
}
```

In order to create a versionConnection from a regular node, you simply pass in the resolver node result into the `versionConnection` instance.

For example:

```typescript
const directionTree: DirectionTreeQuery = async (parent, args, ctx, info) => {
    const {connection} = ctx.clients.sqlClient;
    const records = (await directionQueryBuilder((connection as Knex).queryBuilder())
        .orWhere({'direction.root_id': args.directionTreeId})
        .orWhere({'direction.id': args.directionTreeId})) as IDirectionSQL[];

    const currentNode = records.length > 0 ? buildDirectionsNode(records) : null;

    return await versionConnection<DirectionTreeQuery, DirectionTreeNodeRevisionData>(
        currentNode,
        [parent, args, ctx, info],
        {
            knex: ctx.clients.sqlClient.connection,
            nodeBuilder: node => node,
            nodeId: args.directionTreeId,
            nodeName: NODE_NAME.DIRECTION_TREE
        }
    );
};
export default directionTree;
```

## API

### VersionRecorder

### VersionConnection

## GQL Example Usage

Versioned nodes are represented as connections. If you are unfamilar with the Relay connection spec you can read about it [here](https://github.com/social-native/snpkg-snapi-connections#about). This library extends the connection type by adding a `version` field to the `edges` field. The `version` field has three unique implementors `VersionNodeChange`, `VersionNodeLinkChange`, and `VersionNodeFragmentChange`. For the most part, unless you are doing something special you will just use `VersionNodeChange` and `VersionNodeLinkChange` to get version information about node and node links (aka edges to other nodes) changes.

Each edge in a versioned connection represents a version of the node. By default, the nodes are sorted youngest to oldest. Thus, calling a version connection for the first node will give you the current node

You can also use `snpkg-snapi-connection` filters in a version connection query. 

The fields available to filter on are:

- `id`
-  `userId` 
-  `userRole` 
-  `nodeId` 
-  `nodeName` 
-  `createdAt` 
-  `type`
-  `resolverOperation`
  
An example query with extensive filtering could look like:

```graphql
query {
  directionTree(
    directionTreeId: 8021
    first: 50
    filter: {
      and: [
        { field: "id", operator: "=", value: "2" }
        { field: "userId", operator: "=", value: "105208" }
        { field: "userRole", operator: "=", value: "users" }
        { field: "nodeId", operator: "=", value: "145" }
        { field: "nodeName", operator: "=", value: "DIRECTION_TREE" }
        { field: "createdAt", operator: "=", value: "1572048220" }
        { field: "type", operator: "=", value: "LINK_CHANGE" }
        { field: "resolverOperation", operator: "=", value: "CREATE_FULL_TREE" }
      ]
    }
  )
  {
    pageInfo {
      endCursor
      startCursor
      hasPreviousPage
      hasNextPage
    }
    edges {
      cursor
      version {
        id
        userId
        userRoles
        nodeId
        nodeName
        createdAt
        type
        resolverOperation

        ... on VersionNodeChange {
          revisionData
          nodeSchemaVersion
        }

        ... on VersionNodeLinkChange {
          linkNodeId
          linkNodeName
        }

        ... on VersionNodeFragmentChange {
          childNodeId
          childNodeName
          childRevisionData
          childNodeSchemaVersion
        }
      }
      node {
				...InfoSpecificToEachNode
      }
    }
  }
}

}
```
