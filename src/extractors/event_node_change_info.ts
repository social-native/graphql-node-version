import {
    IVersionRecorderExtractors,
    QueryShouldTakeNodeSnapshot,
    IEventInfoBase,
    IEventNodeChangeInfo
} from '../types';

export default async <ResolverT extends (...args: any[]) => any>(
    args: Parameters<ResolverT>,
    extractors: IVersionRecorderExtractors<ResolverT>,
    eventInfoBase: IEventInfoBase,
    queryShouldTakeNodeSnapshot: QueryShouldTakeNodeSnapshot
): Promise<IEventNodeChangeInfo> => {
    const revisionData = extractors.revisionData(args[0], args[1], args[2], args[3]);
    const nodeSchemaVersion = extractors.nodeSchemaVersion;

    const eventNodeChangeInfoWithoutSnapshot = {...eventInfoBase, revisionData, nodeSchemaVersion};
    const includeSnapshot = queryShouldTakeNodeSnapshot(eventNodeChangeInfoWithoutSnapshot);
    const snapshot = includeSnapshot
        ? JSON.stringify(
              await extractors.currentNodeSnapshot(eventInfoBase.nodeId, args as Parameters<
                  ResolverT
              >)
          )
        : undefined;

    return {
        ...eventNodeChangeInfoWithoutSnapshot,
        snapshot
    };
};
