import {IVersionRecorderExtractors, IEventInfoBase} from '../types';
import {DateTime} from 'luxon';

export default <ResolverT extends (...args: any[]) => any>(
    args: Parameters<ResolverT>,
    extractors: IVersionRecorderExtractors<ResolverT>,
    resolverOperation: string,
    nodeId: string | number
): IEventInfoBase => {
    const userId = extractors.userId(args[0], args[1], args[2], args[3]);
    const nodeName = extractors.nodeName;

    const userRoles = extractors.userRoles
        ? extractors.userRoles(args[0], args[1], args[2], args[3])
        : [];

    const createdAt = extractors.eventTime
        ? extractors.eventTime(args[0], args[1], args[2], args[3])
        : // TODO check this
          DateTime.utc().toISO({includeOffset: false});
    // new Date()
    //     .toISOString()
    //     .split('Z')
    //     .join('');

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
