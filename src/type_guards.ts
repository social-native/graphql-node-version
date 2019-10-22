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

export const isNodeBuilderNodeVersionInfoWithSnapshot = <A, B, C>(
    n:
        | IAllNodeBuilderVersionInfo<A, B, C>
        | Required<INodeBuilderNodeChangeVersionInfo<A, B, C>>
        | Required<INodeBuilderNodeFragmentChangeVersionInfo<A, B, C>>
): n is
    | Required<INodeBuilderNodeChangeVersionInfo<A, B, C>>
    | Required<INodeBuilderNodeFragmentChangeVersionInfo<A, B, C>> => {
    return (
        (n as
            | Required<INodeBuilderNodeChangeVersionInfo<A, B, C>>
            | Required<INodeBuilderNodeFragmentChangeVersionInfo<A, B, C>>).snapshot != null // tslint:disable-line
    );
};

export const isNodeBuilderNodeChangeVersionInfo = <A, B, C>(
    n: IAllNodeBuilderVersionInfo<A, B, C> | INodeBuilderNodeChangeVersionInfo<A, B, C>
): n is INodeBuilderNodeChangeVersionInfo<A, B, C> => {
    return (
        (n as INodeBuilderNodeChangeVersionInfo<A, B, C>).revisionData !== undefined &&
        (n as INodeBuilderNodeFragmentChangeVersionInfo<A, B, C>).childRevisionData === undefined
    );
};

export const isNodeBuilderNodeFragmentChangeVersionInfo = <A, B, C>(
    n: IAllNodeBuilderVersionInfo<A, B, C> | INodeBuilderNodeFragmentChangeVersionInfo<A, B, C>
): n is INodeBuilderNodeFragmentChangeVersionInfo<A, B, C> => {
    return (
        (n as INodeBuilderNodeFragmentChangeVersionInfo<A, B, C>).childRevisionData !== undefined
    );
};

export const shouldSkipNodeBuilderBecauseHasLinkChangeVersionInfo = (
    n: IAllNodeBuilderVersionInfo | INodeBuilderVersionInfo
): n is INodeBuilderVersionInfo => {
    return (n as any).revisionData === undefined;
};
