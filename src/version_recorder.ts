import {UnPromisify, IVersionRecorderExtractors, IConfig} from './types';
import {setNames} from './sql_names';
import {
    eventInfoBaseExtractor,
    eventLinkChangeInfoExtractor,
    eventNodeChangeInfoExtractor,
    eventNodeFragmentRegisterInfoExtractor
} from './extractors';
import {createKnexTransaction} from './data_accessors/sql/utils';
import {
    persistVersion as initializePersistVersion,
    createQueryShouldStoreSnapshot
} from './data_accessors/sql';
import {getLoggerFromConfig} from 'logger';

export default (config?: IConfig) => <ResolverT extends (...args: any[]) => any>(
    extractors: IVersionRecorderExtractors<ResolverT>
): MethodDecorator => {
    const tableAndColumnNames = setNames(config ? config.names : undefined);
    const parentLogger = getLoggerFromConfig(config);

    const logger = parentLogger.child({api: 'Version Recorder'});
    return (_target, property, descriptor: TypedPropertyDescriptor<any>) => {
        const {value} = descriptor;
        if (typeof value !== 'function') {
            throw new TypeError('Only functions can be decorated.');
        }

        // tslint:disable-next-line
        descriptor.value = (async (...args: Parameters<ResolverT>) => {
            logger.debug('Extracting knex client');
            const localKnexClient = extractors.knex(args[0], args[1], args[2], args[3]);
            logger.debug('Creating knex transaction');
            const transaction = await createKnexTransaction(localKnexClient);

            logger.debug('Getting current node');
            const node = await callDecoratedNode(value, args);

            logger.debug('Extracting node id');
            const nodeId = extractors.nodeId(node, args[0], args[1], args[2], args[3]);
            if (nodeId === undefined) {
                throw new Error(
                    `Unable to extract node id in version recorder for node ${JSON.stringify(node)}`
                );
            }

            logger.debug('Extracting resolver operation');
            const resolverOperation = getResolverOperation(extractors, property);

            logger.debug('Extracting event base info');
            const eventInfoBase = eventInfoBaseExtractor(
                args,
                extractors,
                resolverOperation,
                nodeId
            );
            logger.debug('Event base info:', eventInfoBase);

            logger.debug('Extracting event link change info');
            const eventLinkChangeInfo = eventLinkChangeInfoExtractor(
                args,
                extractors,
                eventInfoBase
            );
            logger.debug('Event link change info:', eventLinkChangeInfo);

            logger.debug('Extracting event node fragment change info');
            const eventNodeFragmentRegisterInfo = eventNodeFragmentRegisterInfoExtractor(
                args,
                extractors,
                eventInfoBase
            );
            logger.debug('Event node fragment change info:', eventNodeFragmentRegisterInfo);

            logger.debug('Building query fn to determine if snapshot should be retrieved');
            const queryShouldStoreSnapshot = createQueryShouldStoreSnapshot(
                transaction,
                tableAndColumnNames
            );

            logger.debug('Extracting event node change info');
            const eventNodeChangeInfo = await eventNodeChangeInfoExtractor(
                args,
                extractors,
                eventInfoBase,
                queryShouldStoreSnapshot,
                {logger}
            );
            logger.debug('Event node change info:', eventNodeChangeInfo);

            logger.debug('Persisting version information');
            const persistVersion = initializePersistVersion(localKnexClient, transaction, {
                logger,
                names: tableAndColumnNames
            });
            await persistVersion({
                linkChanges: eventLinkChangeInfo,
                nodeChange: eventNodeChangeInfo,
                fragmentRegistration: eventNodeFragmentRegisterInfo
            });

            logger.debug('Committing transaction...');
            await transaction.commit();
            logger.debug('Transaction committed successfully!');

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
    value: (
        ...resolverArgs: any[]
    ) => Promise<UnPromisify<ReturnType<ResolverT>>> | UnPromisify<ReturnType<ResolverT>>,
    args: Parameters<ResolverT>
) => {
    return await value(args[0], args[1], args[2], args[3]);
};
