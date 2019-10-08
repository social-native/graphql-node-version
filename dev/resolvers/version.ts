import {Resolver} from '../types';
import {EVENT_IMPLEMENTOR_TYPE_IDS} from '../../src';
const contentFormatToGraphqlTypeName: {[K in keyof typeof EVENT_IMPLEMENTOR_TYPE_IDS]: string} = {
    NODE_CHANGE: 'VersionNodeChange',
    NODE_FRAGMENT_CHANGE: 'VersionNodeFragmentChange',
    LINK_CHANGE: 'VersionNodeLinkChange'
};

// tslint:disable-next-line
const __resolveType: Resolver<string | undefined, {type: EVENT_IMPLEMENTOR_TYPE_IDS}> = async ({
    type
}) => {
    const graphqlTypeName = contentFormatToGraphqlTypeName[type];

    if (!graphqlTypeName) {
        throw new Error(`Version.__resolveType resolver cannot coerce ${type}`);
    }

    return graphqlTypeName;
};

export default {
    __resolveType
};
