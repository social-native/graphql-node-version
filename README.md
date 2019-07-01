# SNPKG-SNAPI-graphql-node-version :twisted_rightwards_arrows:

## Install

Install by referencing the github location and the release number:

```
npm install --save social-native/snpkg-snapi-graphql-node-version#v1.0.0
```

# RFC:

The core idea:

All mutations happen to `nodes` in the graph. This means that mutations don't map cleanly to single database tables. `snapi-direction` is probably the best example of how a single node is derived from multiple database tables and sql patterns.

In a mutation, both `create` and `update` use the same logic.

When you call a `create` or `update` mutation you are calling a resolver that looks like:

```typescript
const createRevision = ({user, nodeDiff, nodeName}) => ({
  diff: nodeDiff,
  userId: user.app_user_id,
  userRoles: user.roles,
  time: new Date(),
  nodeName,
})

import {calculateDiff, applyRevision, createRevision} from 'snpkg-snapi-revision';

const updateCampaign = (_, {id, ...input}, {user, clients}) => {
  // this makes sure that we are only capturing the diff
  const currentNode = callExistingQueryNode('queryCampaign', id);
  const nodeDiff = calculateDiff(input, currentNode);

  // record revision
  const revision = createRevision({user, nodeDiff, nodeName: 'campaign'});
  applyRevision({nodeName: revision, client: clients.sqlRevisionClient});

  // record update
  clients.sqlClient.update('mytable')...
}
```


This can also be succinctly represented using decorators 

```typescript
@versionable(queryNode: 'queryCampaign', node: 'campaign')
const updateCampaign = (_, {id, diff}, {user, clients}) => {
  // record update
  clients.sqlClient.update('mytable')...
}
```

Looking at versions of a node is handled using connections.


```typescript
 import {revisionAttributeMap, versionableConnection, versionableEdges, revisionQueryBuilder} from 'snpkg-snapi-revision';

 const queryCampaign = (_, {id, first}, {clients}) => {
  const firstNode = clients.sqlClient.connection.queryBuilder().table('campaign').where({id}).first()
  const graphqlNode = buildCampaignNode(firstNode);

  if (first && first === 1) {
    const 
    return versionableConnection(graphqlNode)
  } else {
      const nodeConnection = new ConnectionManager<IRevision<ICampaign>>(input, revisionAttributeMap);

      const result = await nodeConnection.createQuery(revisionQueryBuilder({node: 'campaign', client: clients.sqlRevisionClient}));
      nodeConnection.addResult(result);
      
      return {
        pageInfo: nodeConnection.pageInfo,
        edges: versionableEdges({firstNode, edges: nodeConnection.edges, nodeTransformer: buildCampaigNode})
      };
  }
 }
```

An example revision query looks like:

```graphql
 query {
  campaign(
      first: 2
  ) {
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    edges {
      cursor
      version {
        userId
        userRoles
        date
        isMostRecent
        versionNumber
      }
      node {
        id
        name
      }
    }
  }
}
```


Notice how we just swap out a regular node with a versionableNodeConnection. This means all nodes are potentially versionable. Right from the start we can say all singular nodes are now versionable. If we dont want to support revisions yet for that node, we just dont enable the second part of query reducer!
