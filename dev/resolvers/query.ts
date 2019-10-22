import {ConnectionManager, IInputArgs, IQueryResult} from '@social-native/snpkg-snapi-connections';
import {Resolver, IUserNode, ITodoItem, ITodoList} from '../types';

import {
    IVersionConnection,
    versionConnection as unconfiguredCreateRevisionConnection,
    IAllNodeBuilderVersionInfo,
    ILoggerConfig,
    INodeBuilderFragmentNodes,
    typeGuards,
    nodeBuilder as versionNodeBuilder,
    UnPromisify
} from '../../src';

const versionConnection = unconfiguredCreateRevisionConnection({
    logOptions: {level: 'debug', prettyPrint: true, base: null}
});

interface ITeam {
    id: string;
    name: string;
}

type QueryTeamResolver = Resolver<
    Promise<IVersionConnection<ITeam | null>>,
    undefined,
    {id: string} & IInputArgs
>;
type QueryTodoListResolver = Resolver<
    Promise<IVersionConnection<ITodoList | undefined>>,
    undefined,
    {id: string} & IInputArgs
>;
type QueryTodoItemResolver = Resolver<
    Promise<IVersionConnection<ITodoItem | undefined>>,
    undefined,
    {id: string} & IInputArgs
>;
type QueryUsersResolver = Resolver<Promise<IQueryResult<IUserNode | null>>, undefined, IInputArgs>;
type QueryUserResolver = Resolver<
    Promise<IVersionConnection<IUserNode | null>>,
    undefined,
    {id: string} & IInputArgs
>;

type KnexQueryResult = Array<{[attributeName: string]: any}>;

const query: {
    team: QueryTeamResolver;
    todoList: QueryTodoListResolver;
    todoItem: QueryTodoItemResolver;
    user: QueryUserResolver;
    users: QueryUsersResolver;
} = {
    async team(parent, args, ctx, info) {
        const currentNode = (await ctx.sqlClient
            .from('team')
            .where({id: args.id})
            .first()) as {id: string; name: string};

        return await versionConnection<QueryTeamResolver, {id: 'hi'}, {id: 'hello'}>(
            currentNode,
            [parent, args, ctx, info],
            {
                knex: ctx.sqlClient,
                // nodeBuilder,
                nodeBuilder: (previousNode, versionInfo) => {
                    if (typeGuards.isNodeBuilderNodeChangeVersionInfo(versionInfo)) {
                        const a = versionInfo.revisionData;
                        return {...previousNode, ...a};
                    }
                    if (typeGuards.isNodeBuilderNodeFragmentChangeVersionInfo(versionInfo)) {
                        const a = versionInfo;
                        return {...previousNode, ...a};
                    }
                    return previousNode;
                },
                nodeId: args.id,
                nodeName: 'team'
            }
        );
    },
    async todoList(parent, args, ctx, info) {
        const currentNode = await ctx.sqlClient
            .from('todo_list')
            .where({'todo_list.id': args.id})
            .first();

        return await versionConnection(currentNode, [parent, args, ctx, info], {
            knex: ctx.sqlClient,
            nodeBuilder,
            nodeId: args.id,
            nodeName: 'todoList'
        });
    },
    async todoItem(parent, args, ctx, info) {
        const currentNode = await ctx.sqlClient
            .from('todo_item')
            .where({id: args.id})
            .first();

        return await versionConnection(currentNode, [parent, args, ctx, info], {
            knex: ctx.sqlClient,
            nodeBuilder,
            nodeId: args.id,
            nodeName: 'todoItem'
        });
    },
    async user(parent, args, ctx, info) {
        const currentNode = await ctx.sqlClient
            .table('user')
            .where({id: args.id})
            .first();

        return await versionConnection(currentNode, [parent, args, ctx, info], {
            knex: ctx.sqlClient,
            nodeBuilder,
            nodeId: args.id,
            nodeName: 'user'
        });
    },
    async users(_, inputArgs, {sqlClient}) {
        const queryBuilder = sqlClient.from('user');
        // maps node types to sql column names
        const attributeMap = {
            id: 'id',
            username: 'username',
            firstname: 'firstname',
            age: 'age',
            haircolor: 'haircolor',
            lastname: 'lastname',
            bio: 'bio'
        };

        const nodeConnection = new ConnectionManager<IUserNode>(inputArgs, attributeMap);

        const queryResult = nodeConnection.createQuery(queryBuilder.clone()).select();
        const result = (await queryResult) as KnexQueryResult;

        nodeConnection.addResult(result);

        return {
            pageInfo: nodeConnection.pageInfo,
            edges: nodeConnection.edges
        };
    }
};

const nodeBuilder = <Node extends any, RevisionData, FragmentNode extends object>(
    previousNode: Node,
    versionInfo: IAllNodeBuilderVersionInfo<number, RevisionData>,
    fragmentNodes?: INodeBuilderFragmentNodes<FragmentNode>,
    logger?: ILoggerConfig['logger']
): Node => {
    logger && logger.child({part: 'nodeBuilder'}); // tslint:disable-line
    if (typeGuards.isNodeBuilderNodeChangeVersionInfo(versionInfo)) {
        logger && logger.debug('Node Builder: node change info'); // tslint:disable-line
        return versionNodeBuilder.computeNodeFromNodeChange(previousNode, versionInfo);
    } else if (
        typeGuards.isNodeBuilderNodeFragmentChangeVersionInfo(versionInfo) &&
        fragmentNodes
    ) {
        logger && logger.debug('Node Builder: node fragment change info'); // tslint:disable-line
        const computeNode = (pNode: Node, fragments: FragmentNode[]) => ({
            ...pNode,
            items: fragments || []
        });
        return versionNodeBuilder.computeNodeFromNodeChangeFragment<Node, FragmentNode>(
            previousNode,
            fragmentNodes,
            computeNode
        );
    } else {
        throw new Error('Unknown versionInfo type. Could not build node');
    }
};

export default query;
