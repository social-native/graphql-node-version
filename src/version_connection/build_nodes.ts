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
    ILoggerConfig
} from '../types';
import {getLoggerFromConfig} from '../logger';

export default <ResolverT extends (...args: [any, any, any, any]) => any>(
    minSetOfEventsInConnectionThatStartWithASnapshot: Array<IAllNodeBuilderVersionInfo<number>>,
    extractors: IVersionConnectionExtractors<ResolverT>,
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
                logger.error('Missing initial snapshot for connection', event);
                throw new Error('Missing initial snapshot');
            } else if (isNodeBuilderNodeVersionInfoWithSnapshot(event)) {
                const nodeSnapshot = JSON.parse(event.snapshot);

                if (isNodeBuilderNodeFragmentChangeVersionInfo(event)) {
                    logger.debug('Building node fragment change');

                    const currentFragmentNodes = acc.fragmentNodes;
                    const childNodeByIds = currentFragmentNodes[event.childNodeName] || {};
                    childNodeByIds[event.childNodeId] = nodeSnapshot;

                    acc.fragmentNodes = {
                        ...acc.fragmentNodes,
                        [event.childNodeName]: childNodeByIds
                    };

                    const calculatedNode = extractors.nodeBuilder(
                        acc.lastNode,
                        event,
                        acc.fragmentNodes,
                        logger
                    );
                    acc.fullNodes[event.id] = calculatedNode;
                    acc.lastNode = calculatedNode;
                } else if (isNodeBuilderNodeChangeVersionInfo(event)) {
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
                } else if (shouldSkipNodeBuilderBecauseHasLinkChangeVersionInfo(event)) {
                    logger.debug('Building node link change using last node');

                    acc.fullNodes[event.id] = acc.lastNode;
                } else {
                    throw new Error('Undefined node event without snapshot');
                }
            }

            return acc;
        },
        {fullNodes: {}, fragmentNodes: {}} as {
            fragmentNodes: INodeBuilderFragmentNodes;
            lastNode: UnPromisify<ReturnType<ResolverT>>;
            fullNodes: {[eventId: string]: UnPromisify<ReturnType<ResolverT>>};
        }
    );
    return nodesOfConnectionByEventId;
};
