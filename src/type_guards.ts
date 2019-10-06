import {
    EventInfo,
    IEventNodeChangeInfo,
    IEventNodeChangeWithSnapshotInfo,
    IEventNodeFragmentRegisterInfo,
    IEventLinkChangeInfo
} from 'types';

export const isEventNodeChangeInfo = (e: EventInfo): e is IEventNodeChangeInfo => {
    return (e as IEventNodeChangeInfo).revisionData !== undefined;
};

export const isEventNodeChangeWithSnapshotInfo = (
    e: EventInfo
): e is IEventNodeChangeWithSnapshotInfo => {
    return (e as IEventNodeChangeWithSnapshotInfo).snapshot !== undefined;
};

export const isEventNodeFragmentRegisterInfo = (
    e: EventInfo
): e is IEventNodeFragmentRegisterInfo => {
    return (e as IEventNodeFragmentRegisterInfo).childNodeId !== undefined;
};

export const isEventLinkChangeInfo = (e: EventInfo): e is IEventLinkChangeInfo => {
    return (e as IEventLinkChangeInfo).linkNodeId !== undefined;
};
