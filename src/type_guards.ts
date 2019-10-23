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
import {EVENT_IMPLEMENTOR_TYPE_NAMES} from 'enums';

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

export const isNodeBuilderNodeVersionInfoWithSnapshot = <A, B, C, D>(
    n:
        | IAllNodeBuilderVersionInfo<A, B, C, D>
        | Required<INodeBuilderNodeChangeVersionInfo<A, B, C>>
        | Required<INodeBuilderNodeFragmentChangeVersionInfo<A, B, D>>
): n is
    | Required<INodeBuilderNodeChangeVersionInfo<A, B, C>>
    | Required<INodeBuilderNodeFragmentChangeVersionInfo<A, B, D>> => {
    return (
        (n as Required<INodeBuilderNodeChangeVersionInfo<A, B, C>>).snapshot != null || // tslint:disable-line
        (n as Required<INodeBuilderNodeFragmentChangeVersionInfo<A, B, D>>).childSnapshot != null // tslint:disable-line
    );
};

export const isNodeBuilderNodeChangeVersionInfo = <A, B, C, D>(
    n: IAllNodeBuilderVersionInfo<A, B, C, D> | INodeBuilderNodeChangeVersionInfo<A, B, C>
): n is INodeBuilderNodeChangeVersionInfo<A, B, C> => {
    return (
        (n as INodeBuilderNodeChangeVersionInfo<A, B, C>).type ===
        EVENT_IMPLEMENTOR_TYPE_NAMES.NODE_CHANGE
        // (n as INodeBuilderNodeFragmentChangeVersionInfo<A, B, D>).childRevisionData === undefined
    );
};

export const isNodeBuilderNodeFragmentChangeVersionInfo = <A, B, C, D>(
    n: IAllNodeBuilderVersionInfo<A, B, C, D> | INodeBuilderNodeFragmentChangeVersionInfo<A, B, D>
): n is INodeBuilderNodeFragmentChangeVersionInfo<A, B, D> => {
    return (
        (n as INodeBuilderNodeFragmentChangeVersionInfo<A, B, D>).type ===
        EVENT_IMPLEMENTOR_TYPE_NAMES.NODE_FRAGMENT_CHANGE
    );
};

export const shouldSkipNodeBuilderBecauseHasLinkChangeVersionInfo = <A, B, C, D>(
    n: IAllNodeBuilderVersionInfo<A, B, C, D> | INodeBuilderVersionInfo
): n is INodeBuilderVersionInfo => {
    return (n as any).type === EVENT_IMPLEMENTOR_TYPE_NAMES.LINK_CHANGE;
};
