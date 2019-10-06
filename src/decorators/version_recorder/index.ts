import * as Knex from 'knex';

import {UnPromisify} from '../../types';
import {setNames} from '../../sql_names';
import {IVersionRecorderExtractors, IRevisionInfo} from './types';
import {
    eventInfoBaseExtractor,
    eventLinkChangeInfoExtractor,
    eventNodeChangeInfoExtractor,
    eventNodeChangeWithSnapshotInfoExtractor,
    eventNodeFragmentRegisterInfoExtractor
} from './extractors';

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

            const eventInfoBase = eventInfoBaseExtractor(
                args,
                extractors,
                resolverOperation,
                nodeId
            );
            const eventLinkChangeInfo = eventLinkChangeInfoExtractor(
                args,
                extractors,
                eventInfoBase
            );

            const eventNodeFragmentRegisterInfo = eventNodeFragmentRegisterInfoExtractor(
                args,
                extractors,
                eventInfoBase
            );

            const shouldStoreSnapshot = await findIfShouldStoreSnapshot(
                transaction,
                nodeToSqlNameMappings,
                revisionEventInfo,
                nodeId
            );

            if (shouldStoreSnapshot) {
                const eventNodeChangeWithSnapshotInfo = await eventNodeChangeWithSnapshotInfoExtractor(
                    args,
                    extractors,
                    eventInfoBase
                );
            } else {
                const eventNodeChangeInfo = eventNodeChangeInfoExtractor(
                    args,
                    extractors,
                    eventInfoBase
                );
            }

            await transaction.commit();

            return node;
        }) as ResolverT;

        return descriptor;
    };
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
