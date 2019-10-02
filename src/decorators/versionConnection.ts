import * as Knex from 'knex';
import {DateTime} from 'luxon';

import {
    UnPromisify,
    INamesConfig,
    INamesForTablesAndColumns,
    IRevisionQueryResult,
    INodeBuilderRevisionInfo,
    IRevisionQueryResultWithTimeSecs
} from '../types';
import {ConnectionManager, IQueryResult, IFilter} from '@social-native/snpkg-snapi-connections';

import {setNames} from 'sqlNames';

export interface IVersionConnectionExtractors<Resolver extends (...args: any[]) => any> {
    knex: Knex;
    nodeId: string;
    nodeName: string;
    nodeBuilder: (
        previousModel: UnPromisify<ReturnType<Resolver>>,
        versionInfo: INodeBuilderRevisionInfo
    ) => UnPromisify<ReturnType<Resolver>>;
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
        const {value} = descriptor;
        if (typeof value !== 'function') {
            throw new TypeError('Only functions can be decorated.');
        }

        // tslint:disable-next-line
        descriptor.value = (async (...args) => {
            const latestNode = (await value(args[0], args[1], args[2], args[3])) as UnPromisify<
                ReturnType<ResolverT>
            >;
            return createRevisionConnection(
                latestNode,
                args as Parameters<ResolverT>,
                extractors,
                config
            );
        }) as ResolverT;

        return descriptor;
    };
};

export const createRevisionConnection = async <
    ResolverT extends (...args: [any, any, any, any]) => any
>(
    currentVersionNode: UnPromisify<ReturnType<ResolverT>>,
    resolverArgs: Parameters<ResolverT>,
    extractors: IVersionConnectionExtractors<ResolverT>,
    config?: INamesConfig
) => {
    console.log('CURRENT NODE', currentVersionNode);
    const {knex} = extractors;
    // extractors.knex(resolverArgs[0], resolverArgs[1], resolverArgs[2], resolverArgs[3]);

    const nodeToSqlNameMappings = setNames(config || {});

    // Step 1. Get all revisions in the connection
    console.log('1. GETTING REVISIONS OF INTEREST');
    const revisionsOfInterest = await getRevisionsOfInterest(
        resolverArgs as Parameters<ResolverT>,
        knex,
        nodeToSqlNameMappings,
        extractors
    );

    // Step 2. If there are no revisions in the connection, return with no edges
    if (revisionsOfInterest.edges.length === 0) {
        //     return revisionsOfInterest;
        // }
        const attributeMap = {
            ...nodeToSqlNameMappings.columnNames,
            id: `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
            revisionId: `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
            revisionTime: `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionTime}`,
            userRoles: `${nodeToSqlNameMappings.tableNames.revisionRole}.${nodeToSqlNameMappings.columnNames.roleName}`
        };

        const nodeConnection = new ConnectionManager<IRevisionQueryResultWithTimeSecs>(
            resolverArgs[1],
            attributeMap,
            {
                builderOptions: {
                    filterTransformer: castUnixToDateTime
                },
                resultOptions: {
                    nodeTransformer: castDateTimeToUnixSecs
                }
            }
        );
        nodeConnection.addResult([{}]);
        const {edges, pageInfo} = nodeConnection;
        console.log('HEREEEEE', edges);
        const firstEdge = edges[0];
        return {pageInfo, edges: [{...firstEdge, version: undefined, node: currentVersionNode}]};
    }

    console.log('3. DETERMINING OLDEST REVISION ID');
    // Step 3. Determine the oldest revision with a full node snapshot
    const minRevisionNumber = await getFirstRevisionNumberWithSnapshot(
        revisionsOfInterest,
        knex,
        nodeToSqlNameMappings
    );

    if (minRevisionNumber === undefined) {
        throw new Error('Missing min revision number');
    }

    console.log('4. GETTING ALL REVISIONS IN RANGE');
    // Step 4. Get all revisions in range from the newest revision of interest to the
    //   oldest revision with a snapshot
    const maxRevisionNumber = revisionsOfInterest.edges[0].node.revisionId;
    const {nodeId, nodeName} = revisionsOfInterest.edges[0].node;
    const revisionsInRange = await getRevisionsInRange(
        maxRevisionNumber,
        minRevisionNumber,
        nodeId,
        nodeName,
        knex,
        nodeToSqlNameMappings
    );

    console.log('5. CALCULATE NODE DIFFS');
    // Step 5. Calculate nodes by applying revision diffs to previous node snapshots
    const nodesInRange = calculateNodesInRangeOfInterest(revisionsInRange, extractors);
    // const latestCalculatedNode = nodesInRange[nodesInRange.length - 1];

    console.log('6. BUILD VERSIONED EDGES');
    // Step 6. Build the versioned edges using the full nodes and the desired revisions
    const newEdges = calculateEdgesInRangeOfInterest(revisionsOfInterest, nodesInRange);

    console.log('7. BUILD CONNECTION');
    // Step 7. Build the connection
    return {pageInfo: revisionsOfInterest.pageInfo, edges: newEdges};
};

export interface INodesOfInterest<ResolverT extends (...args: any[]) => any> {
    [revisionId: string]: UnPromisify<ReturnType<ResolverT>>;
}

const calculateEdgesInRangeOfInterest = <ResolverT extends (...args: any[]) => any>(
    revisionsOfInterest: IQueryResult<IRevisionQueryResultWithTimeSecs>,
    nodesInRange: INodesOfInterest<ResolverT>
) => {
    return revisionsOfInterest.edges.map(edge => {
        const {
            revisionData,
            userId,
            nodeName: nn,
            nodeSchemaVersion,
            resolverOperation,
            revisionTime,
            revisionId,
            userRoles
        } = edge.node;
        const version = {
            revisionData,
            userId,
            nodeName: nn,
            nodeSchemaVersion,
            resolverOperation,
            revisionTime,
            revisionId,
            userRoles
        };
        const calculatedNode = nodesInRange[edge.node.revisionId];
        return {...edge, node: calculatedNode, version};
    });
};

const calculateNodesInRangeOfInterest = <ResolverT extends (...args: any[]) => any>(
    revisionsInRange: INodeBuilderRevisionInfo[],
    extractors: IVersionConnectionExtractors<ResolverT>
) => {
    return revisionsInRange.reduce(
        (nodes, revision, index) => {
            console.log('-----------------------------');
            const {revisionId, snapshotData, revisionData} = revision;
            if (index === 0 || snapshotData) {
                console.log('Using snapshot for', revisionId);
                nodes[revisionId] =
                    typeof snapshotData === 'string' ? JSON.parse(snapshotData) : snapshotData;
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
        {} as INodesOfInterest<ResolverT>
    );
};
/**
 * Gets the closest revision with a snapshot to the oldest revision of interest
 * This will be the initial snapshot that full nodes are calculated off of
 */
const getFirstRevisionNumberWithSnapshot = async (
    revisionsOfInterest: IQueryResult<IRevisionQueryResultWithTimeSecs>,
    knex: Knex,
    nodeToSqlNameMappings: INamesForTablesAndColumns
) => {
    if (revisionsOfInterest.edges.length === 0) {
        return undefined;
    }
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
        .first()) as {revisionId: number};

    console.log('resulttttt', result);
    return result.revisionId;
};

const getRevisionsInRange = async (
    maxRevisionNumber: number,
    minRevisionNumber: number,
    nodeId: string | number,
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
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.resolverOperation} as resolverOperation`, // tslint:disable-line

            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId} as revisionId`, // tslint:disable-line
            `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.columnNames.snapshotData} as snapshotData` // tslint:disable-line
        )
        .orderBy(
            `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
            'asc'
        )) as INodeBuilderRevisionInfo[];

    return query;
};

const castUnixToDateTime = (filter: IFilter) => {
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    if (filter.field === 'revisionTime') {
        const date = parseInt(filter.value, 10);
        const value = unixSecondsToSqlTimestamp(date);
        console.log(`Changing revision time from ${filter.value}, to: ${value}`);
        return {
            ...filter,
            value
        };
    }
    return filter;
};

const castDateTimeToUnixSecs = (node: any) => {
    const {revisionTime} = node as IRevisionQueryResult;
    const newRevisionTime = castDateToUTCSeconds(revisionTime);
    console.log('~~~~~~~~~~~', `from: ${revisionTime}`, 'to :', newRevisionTime);
    return {
        ...node,
        revisionTime: newRevisionTime
    };
};

const getRevisionsOfInterest = async <ResolverT extends (...args: any[]) => any>(
    resolverArgs: Parameters<ResolverT>,
    knex: Knex,
    nodeToSqlNameMappings: INamesForTablesAndColumns,
    extractors: IVersionConnectionExtractors<ResolverT>
): Promise<IQueryResult<IRevisionQueryResultWithTimeSecs>> => {
    const attributeMap = {
        ...nodeToSqlNameMappings.columnNames,
        id: `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
        revisionId: `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
        revisionTime: `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionTime}`,
        userRoles: `${nodeToSqlNameMappings.tableNames.revisionRole}.${nodeToSqlNameMappings.columnNames.roleName}`
    };

    // force orderDir to be 'desc' b/c last is most recent in versions
    // const newInputArgs = {...inputArgs, orderDir: 'desc'};
    const nodeConnection = new ConnectionManager<IRevisionQueryResultWithTimeSecs>(
        resolverArgs[1],
        attributeMap,
        {
            builderOptions: {
                filterTransformer: castUnixToDateTime
            },
            resultOptions: {
                nodeTransformer: castDateTimeToUnixSecs
            }
        }
    );

    const {nodeId, nodeName} = extractors;
    // (
    //     resolverArgs[0],
    //     resolverArgs[1],
    //     resolverArgs[2],
    //     resolverArgs[3]
    // );
    // const nodeName = extractors.nodeName(
    //     resolverArgs[0],
    //     resolverArgs[1],
    //     resolverArgs[2],
    //     resolverArgs[3]
    // );

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
                .leftJoin(
                    nodeToSqlNameMappings.tableNames.revisionUserRole,
                    `${nodeToSqlNameMappings.tableNames.revisionUserRole}.${nodeToSqlNameMappings.tableNames.revision}_${nodeToSqlNameMappings.columnNames.revisionId}`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`
                )
                .leftJoin(
                    nodeToSqlNameMappings.tableNames.revisionRole,
                    `${nodeToSqlNameMappings.tableNames.revisionUserRole}.${nodeToSqlNameMappings.tableNames.revisionRole}_${nodeToSqlNameMappings.columnNames.roleId}`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revisionRole}.${nodeToSqlNameMappings.columnNames.roleId}`
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
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.resolverOperation} as resolverOperation`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.userId} as userId`, // tslint:disable-line

                    `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.columnNames.snapshotData} as snapshotData`, // tslint:disable-line
                    `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.columnNames.snapshotTime} as snapshotTime` // tslint:disable-line
                )
                .orderBy(
                    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
                    'desc'
                );

            nodeConnection.createQuery(queryBuilder).as('main');
            console.log('QUERY', queryBuilder.toSQL());
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
            'resolverOperation', // tslint:disable-line
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

const castDateToUTCSeconds = (date: string | Date): number | null => {
    return isDate(date) ? DateTime.fromJSDate(date, {zone: 'local'}).toSeconds() : null;
};

const isDate = (date?: Date | string): date is Date => {
    return date instanceof Date;
};

const unixSecondsToSqlTimestamp = (unixSeconds: number) => {
    return DateTime.fromSeconds(unixSeconds)
        .toUTC()
        .toSQL({includeOffset: true, includeZone: true});
};
