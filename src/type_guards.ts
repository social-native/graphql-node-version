import {
    AllEventInfo,
    IEventNodeChangeInfo,
    IEventNodeChangeWithSnapshotInfo,
    IEventNodeFragmentRegisterInfo,
    IEventLinkChangeInfo
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
