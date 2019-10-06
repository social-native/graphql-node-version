import {UnPromisify, ITableAndColumnNames, IVersionRecorderExtractors} from '../../types';
import {setNames} from '../../sql_names';
import {
    eventInfoBaseExtractor,
    eventLinkChangeInfoExtractor,
    eventNodeChangeInfoExtractor,
    eventNodeFragmentRegisterInfoExtractor
} from './extractors';
import {createKnexTransaction} from './data_accessors/sql/utils';
import {persistVersion, createQueryShouldStoreSnapshot} from './data_accessors/sql';

export default <ResolverT extends (...args: any[]) => any>(
    extractors: IVersionRecorderExtractors<ResolverT>,
    config?: {names: ITableAndColumnNames}
): MethodDecorator => {
    return (_target, property, descriptor: TypedPropertyDescriptor<any>) => {
        const tableAndColumnNames = setNames(config ? config.names : undefined);
        const {value} = descriptor;
        if (typeof value !== 'function') {
            throw new TypeError('Only functions can be decorated.');
        }

        // tslint:disable-next-line
        descriptor.value = (async (...args: Parameters<ResolverT>) => {
            console.log('1. EXTRACTING INFO');
            const localKnexClient = extractors.knex(args[0], args[1], args[2], args[3]);
            const transaction = await createKnexTransaction(localKnexClient);

            console.log('2. GETTING CURRENT NODE');

            const node = await callDecoratedNode(value, args);

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

            const queryShouldStoreSnapshot = createQueryShouldStoreSnapshot(
                transaction,
                tableAndColumnNames
            );

            const eventNodeChangeInfo = await eventNodeChangeInfoExtractor(
                args,
                extractors,
                eventInfoBase,
                queryShouldStoreSnapshot
            );

            await persistVersion(
                {
                    linkChanges: eventLinkChangeInfo,
                    nodeChange: eventNodeChangeInfo,
                    fragmentRegistration: eventNodeFragmentRegisterInfo
                },
                {knex: localKnexClient, transaction, tableAndColumnNames}
            );

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
    value: (
        ...resolverArgs: any[]
    ) => Promise<UnPromisify<ReturnType<ResolverT>>> | UnPromisify<ReturnType<ResolverT>>,
    args: Parameters<ResolverT>
) => {
    return await value(args[0], args[1], args[2], args[3]);
};
