import * as Knex from 'knex';
import {
    UnPromisify,
    IRevisionInfo,
    INamesConfig,
    INamesForTablesAndColumns,
    ResolverArgs
    // Unpacked
} from '../types';
// import {ConnectionManager, IInputArgs} from 'snpkg-snapi-connections';
import {ConnectionManager, IInputArgs} from 'snpkg-snapi-connections';

import {setNames} from 'sqlNames';
// import sqlToNode from 'transformers/sqlToNode';

export interface IVersionConnectionExtractors<Resolver extends (...args: any[]) => any> {
    knex: (...args: Parameters<Resolver>) => Knex;
    nodeBuilder: (
        previousModel: UnPromisify<ReturnType<Resolver>>,
        versionInfo: Partial<IRevisionInfo>
    ) => UnPromisify<ReturnType<Resolver>>;
    nodeId?: (...args: ResolverArgs<Resolver>) => string;
}

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
            const node = (await value(parent, ar, ctx, info)) as UnPromisify<ReturnType<ResolverT>>;

            // Step 1. Get all versions for the connection
            console.log('ARRRRR', ar);
            if (
                ((ar as IInputArgs).first && ar.first <= 1) ||
                (ar.first === undefined && ar.last === undefined)
            ) {
                return node;
            }
            console.log('HEREEE', 'NOT SKIPPING');

            const revisionsOfInterest = await getRevisionsOfInterest(
                ar as any,
                localKnexClient,
                nodeToSqlNameMappings,
                extractors
            );

            // Step 2. Get all the revisions + snapshots used to calculate the oldest revision in
            // the `revisionsOfInterest` array.
            console.log('REVISIONS IN RANGE', revisionsOfInterest);

            return node;
            // const precursorRevisions = await getPrecursorRevisions(
            //     revisionsOfInterest,
            //     ar,
            //     localKnexClient,
            //     nodeToSqlNameMappings,
            //     extractors
            // );

            // const versionEdges = revisionsInRange.reduce(
            //     (edges, version, index) => {
            //         let edge;
            //         if (index === 0) {
            //             edge = {
            //                 version,
            //                 node: extractors.nodeBuilder(node, version)
            //             };
            //         } else {
            //             const previousNode = edges[index - 1].node;
            //             edge = {
            //                 version,
            //                 node: extractors.nodeBuilder(previousNode, version)
            //             };
            //         }
            //         return [...edges, edge];
            //     },
            //     [] as Array<{node: typeof node; version: Unpacked<typeof revisionsInRange>}>
            // );

            // const versionEdgesObjByVersionId = versionEdges.reduce(
            //     (obj, edge) => {
            //         obj[edge.version.id] = edge;
            //         return obj;
            //     },
            //     {} as {[nodeId: string]: Unpacked<typeof versionEdges>}
            // );

            // const connectionOfInterest = await getRevisionsOfInterest(
            //     ar,
            //     localKnexClient,
            //     nodeToSqlNameMappings,
            //     extractors
            // );

            // const edgesOfInterest = connectionOfInterest.edges.map(edge => {
            //     return {
            //         ...edge,
            //         node: versionEdgesObjByVersionId[edge.node.id].node,
            //         version: edge.node
            //     };
            // });

            // return {...connectionOfInterest, edges: edgesOfInterest};
        }) as ResolverT;

        return descriptor;
    };
};

// const getPrecursorRevisions = async <ResolverT extends (...args: any[]) => any>(
//     revisionsInRange: [object],
//     inputArgs: ResolverArgs<ResolverT>,
//     knex: Knex,
//     nodeToSqlNameMappings: INamesForTablesAndColumns,
//     extractors: IVersionConnectionExtractors<ResolverT>
// ) => {};

// const getRevisionsInRange = async <ResolverT extends (...args: any[]) => any>(
//     inputArgs: ResolverArgs<ResolverT>,
//     knex: Knex,
//     nodeToSqlNameMappings: INamesForTablesAndColumns,
//     extractors: IVersionConnectionExtractors<ResolverT>
// ) => {
//     const {
//         id: idName,
//         nodeId: nodeIdName,
//         revisionData: revisionDataName,
//         snapshot: snapshotName,
//         revisionTime: revisionTimeName
//     } = nodeToSqlNameMappings.columnNames;
//     const attributeMap = {
//         id: idName,
//         nodeId: nodeIdName,
//         revisionData: revisionDataName,
//         snapshot: snapshotName,
//         revisionTime: `${nodeToSqlNameMappings.tableNames.revision}.${revisionTimeName}`
//     };

//     const {id, ...selectableAttributes} = attributeMap;

//     const connectionArgs = {orderBy: 'id', orderDir: 'asc'} as IInputArgs;
//     const nodeConnection = new ConnectionManager<typeof attributeMap>(connectionArgs, attributeMap);

//     const nodeId = extractors.nodeId ? extractors.nodeId(...inputArgs) : inputArgs.id;
//     const queryBuilder = knex
//         .queryBuilder()
//         .table(nodeToSqlNameMappings.tableNames.revision)
//         .leftJoin(
//             nodeToSqlNameMappings.tableNames.revisionNodeSnapshot,
//             `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.tableNames.revision}_id`, // tslint:disable-line
//             `${nodeToSqlNameMappings.tableNames.revision}.id`
//         )
//         .where({[nodeToSqlNameMappings.columnNames.nodeId]: nodeId})
//         .select([
//             `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.id}`,
//             ...Object.values(selectableAttributes)
//         ]);
//     const result = await nodeConnection.createQuery(queryBuilder);

//     nodeConnection.addResult(result);
//     return nodeConnection.edges.map(({node}) => node);
// };

const getRevisionsOfInterest = async <ResolverT extends (...args: any[]) => any>(
    inputArgs: ResolverArgs<ResolverT>,
    knex: Knex,
    nodeToSqlNameMappings: INamesForTablesAndColumns,
    extractors: IVersionConnectionExtractors<ResolverT>
) => {
    // const {
    //     id: idName,
    //     nodeId: nodeIdName,
    //     revisionData: revisionDataName,
    //     snapshot: snapshotName,
    //     revisionTime: revisionTimeName
    // } = nodeToSqlNameMappings.columnNames;
    const attributeMap = {
        ...nodeToSqlNameMappings.columnNames,
        id: `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
        revisionTime: `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionTime}`

        // nodeId: `${nodeToSqlNameMappings.tableNames.revision}.${nodeIdName}`,
        // revisionData: revisionDataName,
        // snapshot: snapshotName,
        // revisionTime: `${nodeToSqlNameMappings.tableNames.revision}.${revisionTimeName}`
    };
    // const attributeMap = nodeToSqlNameMappings.columnNames;

    // force orderDir to be 'desc' b/c last is most recent in versions
    // const newInputArgs = {...inputArgs, orderDir: 'desc'};
    const nodeConnection = new ConnectionManager<typeof attributeMap>(inputArgs, attributeMap);

    const nodeId = extractors.nodeId ? extractors.nodeId(...inputArgs) : inputArgs.id;

    // const {id, snapshot, revisionTime, ...selectableAttributes} = attributeMap;
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
                    [`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeId}`]: nodeId
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
            // `main.${nodeToSqlNameMappings.columnNames.id}`,
            // ...Object.values(selectableAttributes)
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
    // console.log('RAW RESULT', result);
    // const nodeResult = result.map(r => sqlToNode(nodeToSqlNameMappings, r)) as ReturnType<
    //     ResolverT
    // >;
    console.log('NODE RESULT', nodeResult);
    const uniqueVersions = aggregateVersionsById(nodeResult);
    console.log('UNIQUE VERSIONS', uniqueVersions);

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
