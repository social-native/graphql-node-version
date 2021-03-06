import {
    isNodeBuilderNodeVersionInfoWithSnapshot,
    isNodeBuilderNodeFragmentChangeVersionInfo,
    isNodeBuilderNodeChangeVersionInfo,
    shouldSkipNodeBuilderBecauseHasLinkChangeVersionInfo
} from '../type_guards';
import {
    INodeBuilderFragmentNodes,
    UnPromisify,
    IVersionConnectionExtractors,
    IAllNodeBuilderVersionInfo,
    ILoggerConfig,
    ExtractNodeFromVersionConnection,
    IVersionConnection
} from '../types';
import {getLoggerFromConfig} from '../logger';

export default <
    ResolverT extends (...args: [any, any, any, any]) => Promise<IVersionConnection<any>>,
    RevisionData = any,
    ChildNode = any,
    ChildRevisionData = any
>(
    minSetOfEventsInConnectionThatStartWithASnapshot: Array<
        IAllNodeBuilderVersionInfo<
            number,
            ExtractNodeFromVersionConnection<UnPromisify<ReturnType<ResolverT>>>,
            RevisionData,
            ChildNode,
            ChildRevisionData
        >
    >,
    extractors: IVersionConnectionExtractors<ResolverT, RevisionData, ChildNode, ChildRevisionData>,
    loggerConfig?: ILoggerConfig
) => {
    const parentLogger = getLoggerFromConfig(loggerConfig);
    const logger = parentLogger.child({step: 'Build full nodes for each edge in connection'});

    const {
        fullNodes: nodesOfConnectionByEventId
    } = minSetOfEventsInConnectionThatStartWithASnapshot.reverse().reduce(
        (acc, event, index) => {
            // tslint:disable-next-line
            logger.debug('Building node for type: ', event.type);

            if (index === 0 && !isNodeBuilderNodeVersionInfoWithSnapshot(event)) {
                logger.warn('Missing initial snapshot for connection', event);
                return acc;
                // throw new Error('Missing initial snapshot');
            } else if (isNodeBuilderNodeVersionInfoWithSnapshot(event)) {
                if (isNodeBuilderNodeFragmentChangeVersionInfo(event)) {
                    const childSnapshot = event.childSnapshot;

                    logger.debug('Building node fragment change');

                    const currentFragmentNodes = acc.fragmentNodes;
                    const childNodeByIds = (currentFragmentNodes[event.childNodeName] || {}) as {
                        [id: string]: ChildNode;
                    };
                    childNodeByIds[event.childNodeId] = childSnapshot;

                    acc.fragmentNodes = {
                        ...acc.fragmentNodes,
                        [event.childNodeName]: childNodeByIds
                    };

                    const calculatedNode = extractors.nodeBuilder(
                        acc.lastNode,
                        event,
                        {...acc.fragmentNodes},
                        logger
                    );
                    acc.fullNodes[event.id] = calculatedNode;
                    acc.lastNode = calculatedNode;
                } else if (isNodeBuilderNodeChangeVersionInfo(event)) {
                    const nodeSnapshot = event.snapshot;

                    logger.debug('Building node change using snapshot');

                    acc.fullNodes[event.id] = nodeSnapshot;
                    acc.lastNode = nodeSnapshot;
                } else {
                    throw new Error('Undefined node event with snapshot');
                }
            } else {
                if (isNodeBuilderNodeChangeVersionInfo(event)) {
                    logger.debug('Building node change and calling node builder');

                    const calculatedNode = extractors.nodeBuilder(
                        acc.lastNode,
                        event,
                        undefined,
                        logger
                    );
                    acc.fullNodes[event.id] = calculatedNode;
                    acc.lastNode = calculatedNode;
                } else if (isNodeBuilderNodeFragmentChangeVersionInfo(event)) {
                    logger.debug('Building node fragment change and calling node builder');
                    const currentFragmentNodes = acc.fragmentNodes;
                    const childNodeByIds = (currentFragmentNodes[event.childNodeName] || {}) as {
                        [id: string]: ChildNode;
                    };
                    const childSnapshot = childNodeByIds[event.childNodeId];

                    if (!extractors.fragmentNodeBuilder) {
                        throw new Error(
                            'Fragment node builder must be defined for nodes that have fragments'
                        );
                    }
                    const calculatedChildNode = extractors.fragmentNodeBuilder(
                        childSnapshot,
                        event,
                        logger
                    );

                    childNodeByIds[event.childNodeId] = calculatedChildNode;

                    acc.fragmentNodes = {
                        ...acc.fragmentNodes,
                        [event.childNodeName]: childNodeByIds
                    };

                    const calculatedNode = extractors.nodeBuilder(
                        acc.lastNode,
                        event,
                        {...acc.fragmentNodes},
                        logger
                    );

                    acc.fullNodes[event.id] = calculatedNode;
                    acc.lastNode = calculatedNode;
                } else if (shouldSkipNodeBuilderBecauseHasLinkChangeVersionInfo(event)) {
                    logger.debug('Building node link change using last node');

                    acc.fullNodes[event.id] = acc.lastNode;
                } else {
                    logger.error('Undefined node event without snapshot', event);
                    throw new Error('Undefined node event without snapshot');
                }
            }

            return acc;
        },
        {fullNodes: {}, fragmentNodes: {}} as {
            fragmentNodes: INodeBuilderFragmentNodes<ChildNode>;
            lastNode: ExtractNodeFromVersionConnection<UnPromisify<ReturnType<ResolverT>>>;
            fullNodes: {
                [eventId: string]: ExtractNodeFromVersionConnection<
                    UnPromisify<ReturnType<ResolverT>>
                >;
            };
        }
    );
    return nodesOfConnectionByEventId;
};
