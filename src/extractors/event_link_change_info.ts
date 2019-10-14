import {IVersionRecorderExtractors, IEventLinkChangeInfo, IEventInfoBase} from '../types';

export default <ResolverT extends (...args: any[]) => any>(
    args: Parameters<ResolverT>,
    extractors: IVersionRecorderExtractors<ResolverT>,
    eventInfoBase: IEventInfoBase
): IEventLinkChangeInfo[] => {
    const edgesToRecord = extractors.edges
        ? extractors.edges(args[0], args[1], args[2], args[3])
        : [];

    const edgesToRecordErrors = edgesToRecord
        ? edgesToRecord.filter(node => node.nodeId === undefined || node.nodeName === undefined)
        : [];

    if (edgesToRecordErrors.length > 0) {
        throw new Error(
            `Missing info found in edgesToRecord ${JSON.stringify(edgesToRecordErrors)}`
        );
    }

    // Events need to be in terms of both the edge and the link
    // So one edge revision will lead to two events (one for each node)
    return edgesToRecord.reduce(
        (acc, edge) => {
            const eventOne = {
                ...eventInfoBase,
                linkNodeId: edge.nodeId.toString(),
                linkNodeName: edge.nodeName
            };
            const eventTwo = {
                ...eventInfoBase,
                nodeId: edge.nodeId.toString(),
                nodeName: edge.nodeName,
                linkNodeId: eventInfoBase.nodeName,
                linkNodeName: eventInfoBase.nodeId.toString()
            };
            acc.push(eventOne);
            acc.push(eventTwo);
            return acc;
        },
        [] as IEventLinkChangeInfo[]
    );
};
