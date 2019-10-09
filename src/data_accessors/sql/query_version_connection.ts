import Knex from 'knex';
import {
    ITableAndColumnNames,
    StringValueWithKey,
    IGqlVersionNode,
    IVersionConnectionInfo,
    NodeInConnection,
    ILoggerConfig
} from 'types';
import {
    ConnectionManager,
    IQueryResult,
    IInputArgs,
    IFilter
} from '@social-native/snpkg-snapi-connections';
import {unixSecondsToSqlTimestamp, castDateToUTCSeconds} from 'lib/time';
import {getLoggerFromConfig} from 'logger';
import {isGqlNodeChangeNode} from 'type_guards';

const castUnixToDateTimeInFilter = (logger?: ILoggerConfig['logger']) => (filter: IFilter) => {
    if (filter.field === 'createdAt') {
        const date = parseInt(filter.value, 10);
        const value = unixSecondsToSqlTimestamp(date);
        logger && logger.debug('Casting unixSecs -> dateTime', filter.value, value); // tslint:disable-line

        return {
            ...filter,
            value
        };
    }
    return filter;
};

const castNodeWithRevisionTimeInDateTimeToUnixSecs = (logger?: ILoggerConfig['logger']) => <
    T extends {createdAt: string}
>(
    node: T
): T & {createdAt: number} => {
    const {createdAt} = node;
    const newRevisionTime = castDateToUTCSeconds(createdAt);
    logger && logger.debug('Casting dateTime -> unixSecs', createdAt, newRevisionTime); // tslint:disable-line

    return {
        ...node,
        createdAt: newRevisionTime
    };
};

type NodesInConnectionUnprocessed = Array<NodeInConnection & {roleName: string}>;

// extractors: IVersionConnectionExtractors<ResolverT>

const nodeTransformer = (logger?: ILoggerConfig['logger']) => {
    const firstTransformer = castNodeWithRevisionTimeInDateTimeToUnixSecs(logger);
    return (node: any) => {
        const unixSecTransformed = firstTransformer(node) as IGqlVersionNode;
        if (isGqlNodeChangeNode(unixSecTransformed)) {
            const {revisionData} = unixSecTransformed;
            return {
                ...unixSecTransformed,
                revisionData:
                    typeof revisionData === 'object' ? JSON.stringify(revisionData) : revisionData
            };
        }
        return unixSecTransformed;
    };
};

export default async <ResolverT extends (...args: any[]) => any>(
    connectionInputs: IInputArgs,
    knex: Knex,
    {
        table_names,
        event,
        role,
        event_implementor_type,
        event_link_change,
        event_node_change,
        event_node_fragment_register,
        user_role,
        node_snapshot
    }: ITableAndColumnNames,
    nodeInstances: Array<Pick<IVersionConnectionInfo<ResolverT>, 'nodeId' | 'nodeName'>>,
    loggerConfig?: ILoggerConfig
): //  INamesForTablesAndColumns,
// extractors: IVersionConnectionExtractors<ResolverT>
Promise<IQueryResult<NodeInConnection & {snapshot?: string}>> => {
    const parentLogger = getLoggerFromConfig(loggerConfig);
    const logger = parentLogger.child({query: 'Version connection'});

    const attributeMap = {
        id: `${table_names.event}.${event.id}`,
        createdAt: `${table_names.event}.${event.created_at}`,
        nodeName: `${table_names.event}.${event.node_name}`,
        nodeId: `${table_names.event}.${event.node_id}`,
        // userRoles: `${table_names.role}.${role.role}`,
        userId: `${table_names.event}.${event.user_id}`,
        type: `${table_names.event_implementor_type}.${event_implementor_type.type}`,
        resolverOperation: `${table_names.event}.${event.resolver_operation}`,
        linkNodeId: `${table_names.event_link_change}.${event_link_change.node_name}`,
        linkNodeName: `${table_names.event_link_change}.${event_link_change.node_id}`,
        revisionData: `${table_names.event_node_change}.${event_node_change.revision_data}`,
        nodeSchemaVersion: `${table_names.event_node_change}.${event_node_change.node_schema_version}`,
        childNodeId: `${table_names.event_node_fragment_register}.${event_node_fragment_register.child_node_id}`,
        childNodeName: `${table_names.event_node_fragment_register}.${event_node_fragment_register.parent_node_name}`
    } as Omit<StringValueWithKey<IGqlVersionNode>, 'userRoles'>; // TODO renable user roles
    logger.debug('Connection attribute map', attributeMap);

    // force orderDir to be 'desc' b/c last is most recent in versions
    // const newInputArgs = {...inputArgs, orderDir: 'desc'};
    const nodeConnection = new ConnectionManager<IGqlVersionNode>(connectionInputs, attributeMap, {
        builderOptions: {
            filterTransformer: castUnixToDateTimeInFilter(logger)
        },
        resultOptions: {
            nodeTransformer: nodeTransformer(logger)
        }
    });

    const query = knex
        .queryBuilder()
        .from(function() {
            // const {roleName, snapshot: unusedSnapshot, ...attributes} = attributeMap;
            const queryBuilder = this.table(table_names.event)
                .leftJoin(
                    table_names.event_implementor_type,
                    `${table_names.event_implementor_type}.${event_implementor_type.id}`,
                    `${table_names.event}.${event.implementor_type_id}`
                )
                .leftJoin(
                    table_names.event_link_change,
                    `${table_names.event_link_change}.${event_link_change.event_id}`,
                    `${table_names.event}.${event.id}`
                )
                .leftJoin(
                    table_names.event_node_change,
                    `${table_names.event_node_change}.${event_node_change.event_id}`,
                    `${table_names.event}.${event.id}`
                )
                // .leftJoin(
                //     table_names.user_role,
                //     `${table_names.user_role}.${user_role.event_id}`,
                //     `${table_names.event}.${event.id}`
                // )
                // .leftJoin(
                //     table_names.role,
                //     `${table_names.role}.${role.id}`,
                //     `${table_names.user_role}.${user_role.role_id}`
                // )
                .leftJoin(
                    table_names.node_snapshot,
                    `${table_names.node_snapshot}.${node_snapshot.event_id}`,
                    `${table_names.event}.${event.id}`
                )
                .andWhere((k: Knex) => {
                    nodeInstances.forEach(({nodeId, nodeName}) => {
                        k.orWhere({
                            [`${table_names.event}.${event.node_id}`]: nodeId,
                            [`${table_names.event}.${event.node_name}`]: nodeName
                        });
                    });
                })
                .select(
                    `${table_names.event_implementor_type}.${event_implementor_type.type} as type`,

                    `${table_names.event}.${event.id} as id`,
                    `${table_names.event}.${event.created_at} as createdAt`,
                    `${table_names.event}.${event.node_name} as nodeName`,
                    `${table_names.event}.${event.node_id} as nodeId`,
                    `${table_names.event}.${event.user_id} as userId`,
                    `${table_names.event}.${event.resolver_operation} as resolverOperation`,

                    `${table_names.event_link_change}.${event_link_change.node_id} as linkNodeId`,
                    `${table_names.event_link_change}.${event_link_change.node_name} as linkNodeName`,

                    `${table_names.event_node_change}.${event_node_change.revision_data} as revisionData`,
                    `${table_names.event_node_change}.${event_node_change.node_schema_version} as nodeSchemaVersion`,

                    `${table_names.node_snapshot}.${node_snapshot.snapshot} as snapshot`

                    // `${table_names.role}.${role.role} as roleName`
                )
                .orderBy(`${table_names.event}.${event.created_at}`, 'desc')
                .orderBy(`${table_names.event}.${event.id}`, 'desc');

            nodeConnection.createQuery(queryBuilder).as('main');
        })
        .leftJoin(
            table_names.user_role,
            `${table_names.user_role}.${user_role.event_id}`,
            `main.id`
        )
        .leftJoin(
            table_names.role,
            `${table_names.role}.${role.id}`,
            `${table_names.user_role}.${user_role.role_id}`
        )
        .select(
            'type',
            'main.id as id',
            'createdAt',
            'revisionData',
            'nodeName',
            'nodeSchemaVersion',
            'nodeId',
            'resolverOperation',
            'linkNodeId',
            'linkNodeName',
            'userId',
            'snapshot',
            `${table_names.role}.${role.role} as roleName`
        );

    logger.debug('Raw SQL:', query.toQuery());
    const nodeResult = (await query) as NodesInConnectionUnprocessed;
    const uniqueVersions = aggregateVersionsById(nodeResult);
    nodeConnection.addResult(uniqueVersions);
    const {pageInfo, edges} = nodeConnection;
    return {pageInfo, edges};
};

/**
 * B/c user roles are 1:many with a revision we have duplicates of revisions
 * for each user role. Thus, we need to combine user roles together into an array for
 * each duplicate of a revision.
 */
const aggregateVersionsById = (
    nodeVersions: NodesInConnectionUnprocessed,
    _logger?: ILoggerConfig['logger']
) => {
    // extract all the user roles for the version
    const rolesByRevisionId = nodeVersions.reduce(
        (rolesObj, {id, roleName}) => {
            const roleNames = rolesObj[id] || [];

            rolesObj[id] = roleNames.includes(roleName) ? roleNames : [...roleNames, roleName];
            return rolesObj;
        },
        {} as {[id: string]: string[]}
    );

    // map over the versions
    // - aggregate by version id
    // - serialize revision data to json if its not already
    // - add user roles
    const versions = nodeVersions.reduce(
        (uniqueVersions, version) => {
            if (uniqueVersions[version.id]) {
                return uniqueVersions;
            }
            uniqueVersions[version.id] = {
                ...version,
                userRoles: rolesByRevisionId[version.id]

                // TODO reimplement
                // revisionData:
                //     typeof version.revisionData === 'string'
                //         ? version.revisionData
                //         : JSON.stringify(version.revisionData)
            };
            return uniqueVersions;
        },
        {} as {
            [id: string]: NodeInConnection;
        }
    );

    // make sure versions are returned in the same order as they came in
    return [...new Set(nodeVersions.map(({id}) => id))].map(id => versions[id]);
};
