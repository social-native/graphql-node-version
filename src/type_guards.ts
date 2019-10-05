import {
    EventInfo,
    IEventNodeChangeInfo,
    IEventNodeFragmentChangeInfo,
    IEventLinkChangeInfo
} from 'types';

export const isEventNodeChangeInfo = (e: EventInfo): e is IEventNodeChangeInfo => {
    return (e as IEventNodeChangeInfo).revisionData !== undefined;
};

export const isEventNodeFragmentChangeInfo = (e: EventInfo): e is IEventNodeFragmentChangeInfo => {
    return (e as IEventNodeFragmentChangeInfo).childNodeId !== undefined;
};

export const isEventLinkChangeInfo = (e: EventInfo): e is IEventLinkChangeInfo => {
    return (e as IEventLinkChangeInfo).linkNodeId !== undefined;
};
