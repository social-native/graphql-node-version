import {
    AllEventInfo,
    IEventNodeChangeInfo,
    IEventNodeChangeWithSnapshotInfo,
    IEventNodeFragmentRegisterInfo,
    IEventLinkChangeInfo,
    IGqlVersionNodeChangeNode,
    IGqlVersionNode,
    INodeBuilderNodeChangeVersionInfo,
    IAllNodeBuilderVersionInfo,
    INodeBuilderNodeFragmentChangeVersionInfo,
    INodeBuilderVersionInfo
} from './types';

export const isEventNodeChangeInfo = (e: AllEventInfo): e is IEventNodeChangeInfo => {
    return (e as IEventNodeChangeInfo).revisionData !== undefined;
};

export const isEventNodeChangeWithSnapshotInfo = (
    e: AllEventInfo
): e is IEventNodeChangeWithSnapshotInfo => {
    return (e as IEventNodeChangeWithSnapshotInfo).snapshot !== undefined;
};

export const isEventNodeFragmentRegisterInfo = (
    e: AllEventInfo
): e is IEventNodeFragmentRegisterInfo => {
    return (e as IEventNodeFragmentRegisterInfo).childNodeId !== undefined;
};

export const isEventLinkChangeInfo = (e: AllEventInfo): e is IEventLinkChangeInfo => {
    return (e as IEventLinkChangeInfo).linkNodeId !== undefined;
};

export const isGqlNodeChangeNode = (
    n: IGqlVersionNode | IGqlVersionNodeChangeNode
): n is IGqlVersionNodeChangeNode => {
    return (n as IGqlVersionNodeChangeNode).revisionData !== undefined;
};

export const isNodeBuilderNodeVersionInfoWithSnapshot = (
    n:
        | IAllNodeBuilderVersionInfo
        | Required<INodeBuilderNodeChangeVersionInfo>
        | Required<INodeBuilderNodeFragmentChangeVersionInfo>
): n is
    | Required<INodeBuilderNodeChangeVersionInfo>
    | Required<INodeBuilderNodeFragmentChangeVersionInfo> => {
    return (
        (n as
            | Required<INodeBuilderNodeChangeVersionInfo>
            | Required<INodeBuilderNodeFragmentChangeVersionInfo>).snapshot != null // tslint:disable-line
    );
};

export const isNodeBuilderNodeChangeVersionInfo = (
    n: IAllNodeBuilderVersionInfo | INodeBuilderNodeChangeVersionInfo
): n is INodeBuilderNodeChangeVersionInfo => {
    return (
        (n as INodeBuilderNodeChangeVersionInfo).revisionData !== undefined &&
        (n as INodeBuilderNodeFragmentChangeVersionInfo).childRevisionData === undefined
    );
};

export const isNodeBuilderNodeFragmentChangeVersionInfo = (
    n: IAllNodeBuilderVersionInfo | INodeBuilderNodeFragmentChangeVersionInfo
): n is INodeBuilderNodeFragmentChangeVersionInfo => {
    return (n as INodeBuilderNodeFragmentChangeVersionInfo).childRevisionData !== undefined;
};

export const shouldSkipNodeBuilderBecauseHasLinkChangeVersionInfo = (
    n: IAllNodeBuilderVersionInfo | INodeBuilderVersionInfo
): n is INodeBuilderVersionInfo => {
    return (n as any).revisionData === undefined;
};
