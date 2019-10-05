import {IVersionRecorderExtractors} from '../types';
import {IEventInfoBase, IEventNodeChangeInfo} from 'types';

export default <ResolverT extends (...args: any[]) => any>(
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
