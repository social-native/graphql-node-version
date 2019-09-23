import * as Knex from 'knex';
import {
    UnPromisify,
    INamesConfig,
    INamesForTablesAndColumns,
    ResolverArgs,
    IRevisionQueryResult,
    INodeBuilderRevisionInfo
    // IRevisionInfo
    // Unpacked
} from '../types';
// import {ConnectionManager, IInputArgs} from 'snpkg-snapi-connections';
import {
    ConnectionManager,
    // IInputArgs,
    IQueryResult
    // QueryResult
} from '@social-native/snpkg-snapi-connections';

import {setNames} from 'sqlNames';
// import sqlToNode from 'transformers/sqlToNode';

export interface IVersionConnectionExtractors<Resolver extends (...args: any[]) => any> {
    knex: (...args: Parameters<Resolver>) => Knex;
    nodeBuilder: (
        previousModel: UnPromisify<ReturnType<Resolver>>,
        versionInfo: INodeBuilderRevisionInfo
    ) => UnPromisify<ReturnType<Resolver>>;
    nodeId: (...args: ResolverArgs<Resolver>) => string;
    nodeName: (...args: ResolverArgs<Resolver>) => string;
}

/**
 * Logic:
 * 1. Get all revisions in range of connection
 * 2. Calculate full nodes for all revisions in range
 * 3. Get revisions in connection (filters may apply etc)
 */
export default <ResolverT extends (...args: [any, any, any, any]) => any>(
    extractors: IVersionConnectionExtractors<ResolverT>,
    config?: INamesConfig
): MethodDecorator => {
    return (_target, _property, descriptor: TypedPropertyDescriptor<any>) => {
        const nodeToSqlNameMappings = setNames(config || {});
        const {value} = descriptor;
        if (typeof value !== 'function') {
            throw new TypeError('Only functions can be decorated.');
        }

        // tslint:disable-next-line
        descriptor.value = (async (...args) => {
            const localKnexClient =
                extractors.knex && extractors.knex(...(args as Parameters<ResolverT>));

            const [parent, ar, ctx, info] = args;
            const latestNode = (await value(parent, ar, ctx, info)) as UnPromisify<
                ReturnType<ResolverT>
            >;

            // Step 1. Get all versions for the connection
            // console.log('ARRRRR', ar);
            // if (
            //     ((ar as IInputArgs).first && ar.first <= 1) ||
            //     (ar.first === undefined && ar.last === undefined)
            // ) {
            //     console.log('RETURNING PLAIN NODE', '')
            //     return node;
            // }

            const revisionsOfInterest = await getRevisionsOfInterest(
                args as any,
                localKnexClient,
                nodeToSqlNameMappings,
                extractors
            );

            // Step 2. Get all the revisions + snapshots used to calculate the oldest revision in
            // the `revisionsOfInterest` array.
            console.log('REVISIONS OF INTEREST', revisionsOfInterest.edges);

            // console.log('WAHHTT', nodesAndRevisionsOfInterest);
            const a = await getFirstRevisionNumberWithSnapshot(
                revisionsOfInterest,
                // ar,
                localKnexClient,
                nodeToSqlNameMappings
                // extractors
            );
            console.log('hi', a);

            const maxRevisionNumber = revisionsOfInterest.edges[0].node.revisionId;
            const minRevisionNumber = a;
            const {nodeId, nodeName} = revisionsOfInterest.edges[0].node;
            const revisionsInRange = await getRevisionsInRange(
                maxRevisionNumber,
                minRevisionNumber,
                nodeId,
                nodeName,
                localKnexClient,
                nodeToSqlNameMappings
            );
            console.log('INNNNN RANGE', revisionsInRange);

            const nodesInRange = revisionsInRange.reduce(
                (nodes, revision, index) => {
                    console.log('-----------------------------');
                    const {revisionId, snapshotData, revisionData} = revision;
                    if (index === 0 || snapshotData) {
                        console.log('Using snapshot for', revisionId);
                        nodes[revisionId] =
                            typeof snapshotData === 'string'
                                ? JSON.parse(snapshotData)
                                : snapshotData;
                    } else {
                        console.log('Calculating node for', revisionId);

                        const previousRevision = revisionsInRange[index - 1];
                        const calculatedNode = extractors.nodeBuilder(
                            nodes[previousRevision.revisionId],
                            revision
                        );
                        console.log('Calculated node', calculatedNode);
                        console.log('Calculated diff', revisionData);

                        nodes[revisionId] = calculatedNode;
                    }
                    return nodes;
                },
                {} as {[revisionId: string]: UnPromisify<ReturnType<ResolverT>>}
            );

            const latestCalculatedNode = nodesInRange[nodesInRange.length - 1];
            console.log('Comparing nodes', latestCalculatedNode, latestNode);

            console.log('NODES IN RANGE', nodesInRange);

            const newEdges = revisionsOfInterest.edges.map(edge => {
                const {
                    revisionData,
                    userId,
                    nodeName: nn,
                    nodeSchemaVersion,
                    resolverName,
                    revisionTime,
                    userRoles
                } = edge.node;
                const version = {
                    revisionData,
                    userId,
                    nodeName: nn,
                    nodeSchemaVersion,
                    resolverName,
                    revisionTime,
                    userRoles
                };
                const calculatedNode = nodesInRange[edge.node.revisionId];
                return {...edge, node: calculatedNode, version};
            });
            return {pageInfo: revisionsOfInterest.pageInfo, edges: newEdges};
        }) as ResolverT;

        return descriptor;
    };
};

/**
 * Gets the closest revision with a snapshot to the oldest revision of interest
 * This will be the initial snapshot that full nodes are calculated off of
 */
const getFirstRevisionNumberWithSnapshot = async (
    revisionsOfInterest: IQueryResult<IRevisionQueryResult>,
    knex: Knex,
    nodeToSqlNameMappings: INamesForTablesAndColumns
) => {
    const firstRevisionInRange = revisionsOfInterest.edges[revisionsOfInterest.edges.length - 1];
    const hasSnapshotData = !!firstRevisionInRange.node.snapshotData;
    if (hasSnapshotData) {
        return firstRevisionInRange.node.revisionId;
    }

    const {nodeId, revisionId: lastRevisionId} = firstRevisionInRange.node;
    const result = (await knex
        .queryBuilder()
        .from(nodeToSqlNameMappings.tableNames.revision)
        .leftJoin(
            nodeToSqlNameMappings.tableNames.revisionNodeSnapshot,
            `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.tableNames.revision}_${nodeToSqlNameMappings.columnNames.revisionId}`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`
        )
        .where({
            [`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeId}`]: nodeId
        })
        .whereNotNull(
            `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.columnNames.snapshotId}` // tslint:disable-line
        )
        .andWhere(
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
            '<',
            `${lastRevisionId} `
        )
        .select(
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId} as revisionId` // tslint:disable-line
        )
        .orderBy(
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
            'desc'
        )
        .first()) as {revisionId: string};

    return result.revisionId;
};

const getRevisionsInRange = async (
    maxRevisionNumber: string,
    minRevisionNumber: string,
    nodeId: string,
    nodeName: string,
    knex: Knex,
    nodeToSqlNameMappings: INamesForTablesAndColumns
) => {
    const query = (await knex
        .queryBuilder()
        .table(nodeToSqlNameMappings.tableNames.revision)
        .leftJoin(
            nodeToSqlNameMappings.tableNames.revisionNodeSnapshot,
            `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.tableNames.revision}_${nodeToSqlNameMappings.columnNames.revisionId}`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`
        )
        .where({
            [`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeId}`]: nodeId, // tslint:disable-line
            [`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeName}`]: nodeName // tslint:disable-line
        })
        .andWhere(
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
            '<=',
            `${maxRevisionNumber} `
        )
        .andWhere(
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
            '>=',
            `${minRevisionNumber} `
        )
        .select(
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionData} as revisionData`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionTime} as revisionTime`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeSchemaVersion} as nodeSchemaVersion`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeName} as nodeName`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeId} as nodeId`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.resolverName} as resolverName`, // tslint:disable-line

            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId} as revisionId`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.columnNames.snapshotData} as snapshotData` // tslint:disable-line
        )
        .orderBy(
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
            'asc'
        )) as INodeBuilderRevisionInfo[];

    return query;
};

const getRevisionsOfInterest = async <ResolverT extends (...args: any[]) => any>(
    resolverArgs: ResolverArgs<ResolverT>,
    knex: Knex,
    nodeToSqlNameMappings: INamesForTablesAndColumns,
    extractors: IVersionConnectionExtractors<ResolverT>
): Promise<IQueryResult<IRevisionQueryResult>> => {
    const attributeMap = {
        ...nodeToSqlNameMappings.columnNames,
        id: `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
        revisionTime: `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionTime}`
    };

    // force orderDir to be 'desc' b/c last is most recent in versions
    // const newInputArgs = {...inputArgs, orderDir: 'desc'};
    const nodeConnection = new ConnectionManager<typeof attributeMap>(
        resolverArgs[1],
        attributeMap
    );

    const nodeId = extractors.nodeId(...resolverArgs);
    const nodeName = extractors.nodeName(...resolverArgs);

    const query = knex
        .queryBuilder()
        .from(function() {
            // const {roleName, snapshot: unusedSnapshot, ...attributes} = attributeMap;
            const queryBuilder = this.table(nodeToSqlNameMappings.tableNames.revision)
                .leftJoin(
                    nodeToSqlNameMappings.tableNames.revisionNodeSnapshot,
                    `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.tableNames.revision}_${nodeToSqlNameMappings.columnNames.revisionId}`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`
                )
                .where({
                    [`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeId}`]: nodeId, // tslint:disable-line
                    [`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeName}`]: nodeName // tslint:disable-line
                })
                .select(
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId} as revisionId`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionTime} as revisionTime`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionData} as revisionData`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeName} as nodeName`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeSchemaVersion} as nodeSchemaVersion`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeId} as nodeId`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.resolverName} as resolverName`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.userId} as userId`, // tslint:disable-line

                    `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.columnNames.snapshotData} as snapshotData`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.columnNames.snapshotTime} as snapshotTime` // tslint:disable-line
                )
                .orderBy(
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
                    'desc'
                );

            nodeConnection.createQuery(queryBuilder).as('main');
        })
        .leftJoin(
            nodeToSqlNameMappings.tableNames.revisionUserRole,
            `${nodeToSqlNameMappings.tableNames.revisionUserRole}.${nodeToSqlNameMappings.tableNames.revision}_${nodeToSqlNameMappings.columnNames.revisionId}`, // tslint:disable-line
            `main.revisionId`
        )
        .leftJoin(
            nodeToSqlNameMappings.tableNames.revisionRole,
            `${nodeToSqlNameMappings.tableNames.revisionUserRole}.${nodeToSqlNameMappings.tableNames.revisionRole}_${nodeToSqlNameMappings.columnNames.roleId}`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revisionRole}.${nodeToSqlNameMappings.columnNames.roleId}`
        )
        .select(
            'revisionId', // tslint:disable-line
            'revisionTime', // tslint:disable-line
            'revisionData', // tslint:disable-line
            'nodeName', // tslint:disable-line
            'nodeSchemaVersion', // tslint:disable-line
            'nodeId', // tslint:disable-line
            'resolverName', // tslint:disable-line
            'userId', // tslint:disable-line
            'snapshotData', // tslint:disable-line
            'snapshotTime', // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revisionRole}.${nodeToSqlNameMappings.columnNames.roleName} as roleName` // tslint:disable-line
        );

    const nodeResult = await query;
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
    nodeVersions: Array<{revisionId: string; roleName: string; revisionData: object}>
) => {
    // extract all the user roles for the version
    const rolesByRevisionId = nodeVersions.reduce(
        (rolesObj, {revisionId, roleName}) => {
            const roleNames = rolesObj[revisionId] || [];

            rolesObj[revisionId] = roleNames.includes(roleName)
                ? roleNames
                : [...roleNames, roleName];
            return rolesObj;
        },
        {} as {[revisionId: string]: string[]}
    );

    // map over the versions
    // - aggregate by version id
    // - serialize revision data to json if its not already
    // - add user roles
    const versions = nodeVersions.reduce(
        (uniqueVersions, version) => {
            if (uniqueVersions[version.revisionId]) {
                return uniqueVersions;
            }
            uniqueVersions[version.revisionId] = {
                ...version,
                userRoles: rolesByRevisionId[version.revisionId],
                revisionData:
                    typeof version.revisionData === 'string'
                        ? version.revisionData
                        : JSON.stringify(version.revisionData)
            };
            return uniqueVersions;
        },
        {} as {
            [revisionId: string]: {revisionId: string; userRoles: string[]; revisionData: string};
        }
    );

    // make sure versions are returned in the same order as they came in
    return [...new Set(nodeVersions.map(({revisionId}) => revisionId))].map(id => versions[id]);
};
