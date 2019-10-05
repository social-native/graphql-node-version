import {IVersionRecorderExtractors} from '../types';
import {IEventInfoBase} from 'types';

export default <ResolverT extends (...args: any[]) => any>(
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
