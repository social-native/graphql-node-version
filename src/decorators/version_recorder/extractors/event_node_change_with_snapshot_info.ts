import {IVersionRecorderExtractors} from '../types';
import {IEventInfoBase, IEventNodeChangeWithSnapshotInfo} from 'types';
import extractEventNodeChangeInfo from './event_node_change_info';
export default async <ResolverT extends (...args: any[]) => any>(
    args: Parameters<ResolverT>,
    extractors: IVersionRecorderExtractors<ResolverT>,
    eventInfoBase: IEventInfoBase
): Promise<IEventNodeChangeWithSnapshotInfo> => {
    const snapshot = await extractors.currentNodeSnapshot(eventInfoBase.nodeId, args as Parameters<
        ResolverT
    >);
    const nodeChangeInfo = extractEventNodeChangeInfo(args, extractors, eventInfoBase);

    return {
        ...nodeChangeInfo,
        snapshot: JSON.stringify(snapshot)
    };
};
