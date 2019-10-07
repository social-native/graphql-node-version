import {
    IVersionRecorderExtractors,
    QueryShouldTakeNodeSnapshot,
    IEventInfoBase,
    IEventNodeChangeInfo,
    ILoggerConfig
} from '../types';
import {getLoggerFromConfig} from 'logger';

export default async <ResolverT extends (...args: any[]) => any>(
    args: Parameters<ResolverT>,
    extractors: IVersionRecorderExtractors<ResolverT>,
    eventInfoBase: IEventInfoBase,
    queryShouldTakeNodeSnapshot: QueryShouldTakeNodeSnapshot,
    loggerConfig?: ILoggerConfig
): Promise<IEventNodeChangeInfo> => {
    const parentLogger = getLoggerFromConfig(loggerConfig);
    const logger = parentLogger.child({step: 'Extract event node change info'});
    const revisionData = extractors.revisionData(args[0], args[1], args[2], args[3]);
    const nodeSchemaVersion = extractors.nodeSchemaVersion;

    const eventNodeChangeInfoWithoutSnapshot = {...eventInfoBase, revisionData, nodeSchemaVersion};
    const includeSnapshot = await queryShouldTakeNodeSnapshot(eventNodeChangeInfoWithoutSnapshot);
    logger.debug('Include node snapshot:', includeSnapshot);

    const snapshot = includeSnapshot
        ? JSON.stringify(
              await extractors.currentNodeSnapshot(eventInfoBase.nodeId, args as Parameters<
                  ResolverT
              >)
          )
        : undefined;
    if (includeSnapshot && snapshot === undefined) {
        logger.error(
            'Missing snapshot for event node change: ',
            eventNodeChangeInfoWithoutSnapshot
        );
    }

    return {
        ...eventNodeChangeInfoWithoutSnapshot,
        snapshot
    };
};
