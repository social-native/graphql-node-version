import * as Knex from 'knex';
import Bluebird from 'bluebird';

import {
    INamesConfig,
    UnPromisify,
    INamesForTablesAndColumns,
    IGqlVersionNodeBase,
    IEventInfoBase,
    IEventNodeChangeInfo,
    IEventLinkChangeInfo,
    IEventNodeFragmentChangeInfo
} from '../../types';
import {setNames} from '../../sqlNames';
import nodeToSql from '../../transformers/nodeToSql';
import {
    ICreateRevisionTransactionConfig,
    IVersionRecorderExtractors,
    IRevisionInfo,
    INode
} from './types';

export default <ResolverT extends (...args: any[]) => any>(
    extractors: IVersionRecorderExtractors<ResolverT>,
    config?: ICreateRevisionTransactionConfig & INamesConfig
): MethodDecorator => {
    return (_target, property, descriptor: TypedPropertyDescriptor<any>) => {
        const nodeToSqlNameMappings = setNames(config);
        const {value} = descriptor;
        if (typeof value !== 'function') {
            throw new TypeError('Only functions can be decorated.');
        }

        // tslint:disable-next-line
        descriptor.value = (async (...args: Parameters<ResolverT>) => {
            console.log('1. EXTRACTING INFO');
            const localKnexClient = extractors.knex(args[0], args[1], args[2], args[3]);
            const transaction = await findOrCreateKnexTransaction(localKnexClient, config);

            console.log('2. GETTING CURRENT NODE');

            const node = await callDecoratedNode(transaction, value, args, extractors);

            console.log('3. EXTRACTING NODE ID');
            const nodeId = extractors.nodeId(node, args[0], args[1], args[2], args[3]);
            if (nodeId === undefined) {
                throw new Error(
                    `Unable to extract node id in version recorder for node ${JSON.stringify(node)}`
                );
            }

            const resolverOperation = getResolverOperation(extractors, property);
            const eventNodeChangeInfo = extractEventNodeChangeInfo(args, extractors);
            const revisionEventInfo = extractEventInfo(args, extractors, resolverOperation, nodeId);

            console.log('4. STORING REVISION');
            const eventId = await storeEvent(
                transaction,
                nodeToSqlNameMappings,
                revisionEventInfo,
                nodeId,
                resolverOperation
            );

            const shouldStoreSnapshot = await findIfShouldStoreSnapshot(
                transaction,
                nodeToSqlNameMappings,
                revisionEventInfo,
                nodeId
            );

            if (shouldStoreSnapshot) {
                let currentNodeSnapshot;
                try {
                    currentNodeSnapshot = await extractors.currentNodeSnapshot(
                        nodeId,
                        args as Parameters<ResolverT>
                    );
                } catch (e) {
                    console.log('EERRRROR', e);
                }

                await storeCurrentNodeSnapshot(
                    transaction,
                    nodeToSqlNameMappings,
                    revisionEventInfo,
                    currentNodeSnapshot,
                    eventId
                );
            }

            if (revisionEventInfo.edgesToRecord) {
                await Bluebird.each(revisionEventInfo.edgesToRecord, async edge => {
                    return await storeEdge(
                        transaction,
                        nodeToSqlNameMappings,
                        eventId,
                        revisionEventInfo,
                        nodeId,
                        edge
                    );
                });
            }
            await storeFragment(transaction, nodeToSqlNameMappings, revisionEventInfo, eventId);

            await transaction.commit();

            return node;
        }) as ResolverT;

        return descriptor;
    };
};

const findOrCreateKnexTransaction = async (
    knex: Knex,
    config: ICreateRevisionTransactionConfig | undefined
) => {
    const transaction = await knex.transaction();

    setTimeout(async () => {
        await transaction.rollback();
        // throw new Error('Detected an orphaned transaction');
    }, ((config && config.transactionTimeoutSeconds) || 10) * 1000);

    return transaction;
};

const storeEvent = async (
    transaction: Knex.Transaction,
    {tableNames, columnNames}: INamesForTablesAndColumns,
    revisionEventInfo: IRevisionInfo,
    eventNodeId: INode['nodeId'],
    eventResolverOperation: string
) => {
    const {
        userRoles,
        eventUserId,
        eventNodeName,
        eventTime,
        nodeChangeRevisionData,
        nodeChangeNodeSchemaVersion
    } = revisionEventInfo;

    // Get the id for event implementor EVENT_NODE_CHANGE
    const eventTypeId = (await transaction
        .table(tableNames.eventImplementorType)
        .where({[columnNames.eventImplementorType]: 'EVENT_NODE_CHANGE'})
        .select(`${columnNames.eventImplementorTypeId} as id`)
        .first()) as {id: number};

    const eventSqlData = nodeToSql(
        {tableNames, columnNames},
        {
            eventTime,
            eventUserId,
            eventNodeName,
            eventNodeId,
            eventResolverOperation,
            [`${tableNames.eventImplementorType}_${columnNames.eventImplementorTypeId}`]: eventTypeId
        }
    );

    // TODO use other method for get last inserted id
    // Insert event data
    const eventId = ((await transaction
        .table(tableNames.event)
        .insert(eventSqlData)
        .returning('id')) as number[])[0];

    // Insert event node change data
    await transaction.table(tableNames.eventNodeChange).insert({
        [`${tableNames.event}_${columnNames.eventId}`]: eventId,
        [columnNames.nodeChangeRevisionData]: nodeChangeRevisionData,
        [columnNames.nodeChangeNodeSchemaVersion]: nodeChangeNodeSchemaVersion
    });

    const roles = userRoles || [];

    // Calculate which role are missing in the db
    const foundRoleNames = await transaction
        .table(tableNames.role)
        .whereIn(columnNames.roleName, roles);
    const foundRoles = foundRoleNames.map((n: any) => n[columnNames.roleName]);
    const missingRoles = roles.filter(i => foundRoles.indexOf(i) < 0);

    // Insert the missing roles
    await transaction.table(tableNames.role).insert(
        missingRoles.map((role: string) => ({
            [columnNames.roleName]: role
        }))
    );

    // Select the role ids
    const ids = (await transaction
        .table(tableNames.role)
        .whereIn(columnNames.roleName, roles)) as Array<{id: number}>;

    // Insert roles ids associated with the revision id
    await transaction.table(tableNames.userRole).insert(
        ids.map(({id}) => ({
            [`${tableNames.role}_${columnNames.roleId}`]: id,
            [`${tableNames.event}_${columnNames.eventId}`]: eventId
        }))
    );

    return eventId;
};

const getResolverOperation = <T extends (...args: any[]) => any>(
    extractors: IVersionRecorderExtractors<T>,
    property: string | symbol
) => {
    const rawResolverOperation = extractors.resolverOperation
        ? extractors.resolverOperation
        : property;

    return typeof rawResolverOperation === 'symbol'
        ? rawResolverOperation.toString()
        : rawResolverOperation;
};

const callDecoratedNode = async <ResolverT extends (...args: any[]) => any>(
    transaction: Knex.Transaction,
    value: (...resolverArgs: any[]) => UnPromisify<ReturnType<ResolverT>>,
    args: Parameters<ResolverT>,
    extractors: IVersionRecorderExtractors<ResolverT>
) => {
    const [parent, ar, ctx, info] = args;
    let newArgs = {};
    if (extractors.passThroughTransaction && extractors.passThroughTransaction === true) {
        newArgs = {...ar, transaction};
    } else {
        newArgs = {...ar};
    }
    const node = await value(parent, newArgs, ctx, info);

    return node;
};

const extractEventNodeChangeInfo = <ResolverT extends (...args: any[]) => any>(
    args: Parameters<ResolverT>,
    extractors: IVersionRecorderExtractors<ResolverT>,
    eventInfoBase: IEventInfoBase
): IEventNodeChangeInfo => {
    const revisionData = extractors.revisionData(args[0], args[1], args[2], args[3]);
    const nodeSchemaVersion = extractors.nodeSchemaVersion;

    return {
        ...eventInfoBase,
        revisionData,
        nodeSchemaVersion
    };
};

const extractEventLinkChangeInfo = <ResolverT extends (...args: any[]) => any>(
    args: Parameters<ResolverT>,
    extractors: IVersionRecorderExtractors<ResolverT>,
    eventInfoBase: IEventInfoBase
): IEventLinkChangeInfo[] => {
    const edgesToRecord = extractors.edges
        ? extractors.edges(args[0], args[1], args[2], args[3])
        : [];

    const edgesToRecordErrors = edgesToRecord
        ? edgesToRecord.filter(node => node.nodeId === undefined || node.nodeName === undefined)
        : [];

    if (edgesToRecordErrors.length > 0) {
        throw new Error(
            `Missing info found in edgesToRecord ${JSON.stringify(edgesToRecordErrors)}`
        );
    }

    // Events need to be in terms of both the edge and the link
    // So one edge revision will lead to two events (one for each node)
    return edgesToRecord.reduce(
        (acc, edge) => {
            const eventOne = {
                ...eventInfoBase,
                linkNodeId: edge.nodeId.toString(),
                linkNodeName: edge.nodeName
            };
            const eventTwo = {
                ...eventInfoBase,
                nodeId: edge.nodeId.toString(),
                nodeName: edge.nodeName,
                linkNodeId: eventInfoBase.nodeName,
                linkNodeName: eventInfoBase.nodeId
            };
            acc.push(eventOne);
            acc.push(eventTwo);
            return acc;
        },
        [] as IEventLinkChangeInfo[]
    );
};

const extractNodeFragmentChangeInfo = <ResolverT extends (...args: any[]) => any>(
    args: Parameters<ResolverT>,
    extractors: IVersionRecorderExtractors<ResolverT>,
    eventInfoBase: IEventInfoBase
): IEventNodeFragmentChangeInfo | undefined => {
    // tslint:disable-next-line
    const fragmentToRecord = extractors.parentNode
        ? extractors.parentNode(args[0], args[1], args[2], args[3])
        : undefined;

    if (!fragmentToRecord) {
        return;
    }

    const fragmentToRecordHasAnError =
        fragmentToRecord &&
        (fragmentToRecord.nodeId === undefined || fragmentToRecord.nodeName === undefined);

    if (fragmentToRecordHasAnError) {
        throw new Error(
            `Missing info found in fragmentToRecord ${JSON.stringify(fragmentToRecord)}`
        );
    }

    const fragment = {
        childNodeId: eventInfoBase.nodeId.toString(),
        childNodeName: eventInfoBase.nodeName,
        parentNodeId: fragmentToRecord.nodeId.toString(),
        parentNodeName: fragmentToRecord.nodeName
    };

    return {
        ...eventInfoBase,
        nodeId: fragmentToRecord.nodeId.toString(),
        nodeName: fragmentToRecord.nodeName,
        ...fragment
    };
};

const extractEventInfo = <ResolverT extends (...args: any[]) => any>(
    args: Parameters<ResolverT>,
    extractors: IVersionRecorderExtractors<ResolverT>,
    resolverOperation: string,
    nodeId: string
): IEventInfoBase => {
    const userId = extractors.userId(args[0], args[1], args[2], args[3]);
    const nodeName = extractors.nodeName;

    const userRoles = extractors.userRoles
        ? extractors.userRoles(args[0], args[1], args[2], args[3])
        : [];

    const createdAt = extractors.eventTime
        ? extractors.eventTime(args[0], args[1], args[2], args[3])
        : // TODO check this
          new Date()
              .toISOString()
              .split('Z')
              .join('');

    const snapshotFrequency = extractors.currentNodeSnapshotFrequency
        ? extractors.currentNodeSnapshotFrequency
        : 1;

    return {
        createdAt,
        userId,
        nodeName,
        nodeId,
        resolverOperation,
        userRoles,
        snapshotFrequency
    };
};

const storeFragment = async (
    transaction: Knex.Transaction,
    {tableNames, columnNames}: INamesForTablesAndColumns,
    revisionInfo: IRevisionInfo,
    revisionId: number
) => {
    if (revisionInfo.fragmentToRecord) {
        const fragment = {
            [columnNames.revisionEdgeTime]: revisionInfo.eventTime,
            [columnNames.fragmentParentNodeId]: revisionInfo.fragmentToRecord.nodeId,
            [columnNames.fragmentParentNodeName]: revisionInfo.fragmentToRecord.nodeName,
            [`${tableNames.revision}_${columnNames.revisionId}`]: revisionId
        };

        await transaction.table(tableNames.revisionFragment).insert(fragment);
    }
};

const storeEdge = async (
    transaction: Knex.Transaction,
    {tableNames, columnNames}: INamesForTablesAndColumns,
    eventId: number,
    revisionEventInfo: IRevisionInfo,
    eventNodeId: string | number,
    edgesToRecord: {nodeId: string | number; nodeName: string}
) => {
    const inputFirst = {
        [`${tableNames.event}_${columnNames.eventId}`]: eventId,
        [columnNames.linkChangeNodeIdA]: eventNodeId,
        [columnNames.linkChangeNodeNameA]: revisionEventInfo.eventNodeName,
        [columnNames.linkChangeNodeIdB]: edgesToRecord.nodeId,
        [columnNames.linkChangeNodeNameB]: edgesToRecord.nodeName
    };

    // switch A and B nodes for faster sql querying
    const inputSecond = {
        [`${tableNames.event}_${columnNames.eventId}`]: eventId,
        [columnNames.linkChangeNodeIdB]: eventNodeId,
        [columnNames.linkChangeNodeNameB]: revisionEventInfo.eventNodeName,
        [columnNames.linkChangeNodeIdA]: edgesToRecord.nodeId,
        [columnNames.linkChangeNodeNameA]: edgesToRecord.nodeName
    };

    await transaction.table(tableNames.eventLinkChange).insert([inputFirst, inputSecond]);
};

/**
 * Write the node snapshot to the database
 */
const storeCurrentNodeSnapshot = async (
    transaction: Knex.Transaction,
    {tableNames, columnNames}: INamesForTablesAndColumns,
    revisionEventInfo: IRevisionInfo,
    currentNodeSnapshot: any,
    eventId: string | number
) => {
    await transaction.table(tableNames.nodeSnapshot).insert({
        [`${tableNames.event}_${columnNames.eventId}`]: eventId,
        [columnNames.snapshotData]: JSON.stringify(currentNodeSnapshot), // tslint:disable-line
        [columnNames.snapshotTime]: revisionEventInfo.eventTime, // tslint:disable-line
        [columnNames.snapshotNodeSchemaVersion]: revisionEventInfo.nodeChangeNodeSchemaVersion // tslint:disable-line
    });
};

/**
 * Fetch the number of full node snapshots for the node id and node schema version
 * If a snapshot exists within the expected snapshot frequency, then we don't need to take another snapshot
 */
const findIfShouldStoreSnapshot = async (
    transaction: Knex.Transaction,
    {tableNames, columnNames}: INamesForTablesAndColumns,
    eventRevisionInfo: IRevisionInfo,
    eventNodeId: string | number
): Promise<boolean> => {
    const sql = transaction
        .table(tableNames.event)
        .leftJoin(
            tableNames.nodeSnapshot,
            `${tableNames.event}.${columnNames.eventId}`,
            `${tableNames.nodeSnapshot}.${tableNames.event}_${columnNames.eventId}`
        )
        .where({
            [`${tableNames.event}.${columnNames.eventNodeName}`]: eventRevisionInfo.eventNodeName,
            [`${tableNames.event}.${columnNames.eventNodeName}`]: eventNodeId,
            // tslint:disable-next-line
            [`${tableNames.nodeSnapshot}.${columnNames.snapshotNodeSchemaVersion}`]: eventRevisionInfo.nodeChangeNodeSchemaVersion
        })
        .orderBy(`${tableNames.event}.${columnNames.eventTime}`, 'desc')
        .limit(eventRevisionInfo.snapshotFrequency)
        .select(
            `${tableNames.event}.${columnNames.eventTime} as event_creation`,
            `${tableNames.nodeSnapshot}.${columnNames.snapshotTime} as snapshot_creation`
        );

    const snapshots = (await sql) as Array<{
        event_creation?: string;
        snapshot_creation?: string;
    }>;
    const snapshotWithinFrequencyRange = !!snapshots.find(data => data.snapshot_creation);

    return !snapshotWithinFrequencyRange;
};
