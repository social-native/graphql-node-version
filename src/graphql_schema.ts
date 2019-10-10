import unixTimeSec from '@social-native/snpkg-graphql-scalar-unix-time-sec';
import {EVENT_IMPLEMENTOR_TYPE_IDS} from 'enums';
import {Resolver} from '../dev/types';

const contentFormatToGraphqlTypeName: {[K in keyof typeof EVENT_IMPLEMENTOR_TYPE_IDS]: string} = {
    NODE_CHANGE: 'VersionNodeChange',
    NODE_FRAGMENT_CHANGE: 'VersionNodeFragmentChange',
    LINK_CHANGE: 'VersionNodeLinkChange'
};

const typeDefs = `
interface Version {
    id: ID!
    createdAt: ${unixTimeSec.type.name}!
    nodeId: ID!
    nodeName: String!
    resolverOperation: String!
    type: String!
    userId: String!
    userRoles: [String]!
}

type VersionNodeChange implements Version {
    id: ID!
    createdAt: ${unixTimeSec.type.name}!
    nodeId: ID!
    nodeName: String!
    resolverOperation: String!
    type: String!
    userId: String!
    userRoles: [String]!

    revisionData: String!
    nodeSchemaVersion: ID!
}

type VersionNodeFragmentChange implements Version {
    id: ID!
    createdAt: ${unixTimeSec.type.name}!
    nodeId: ID!
    nodeName: String!
    resolverOperation: String!
    type: String!
    userId: String!
    userRoles: [String]!

    childNodeId: ID!
    childNodeName: String!
    childRevisionData: String!
    childNodeSchemaVersion: ID!
}

type VersionNodeLinkChange implements Version {
    id: ID!
    createdAt: ${unixTimeSec.type.name}!
    nodeId: ID!
    nodeName: String!
    resolverOperation: String!
    type: String!
    userId: String!
    userRoles: [String]!

    linkNodeId: ID!
    linkNodeName: String!
}
`;

// tslint:disable-next-line
const __resolveType: Resolver<string | undefined, {type: EVENT_IMPLEMENTOR_TYPE_IDS}> = async ({
    type
}: {
    type: EVENT_IMPLEMENTOR_TYPE_IDS;
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

const resolvers = {
    Version: {__resolveType}
};

export {typeDefs, resolvers};
