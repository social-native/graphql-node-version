import Knex from 'knex';
import {INamesConfig, UnPromisify} from '../../types';

export interface IVersionRecorderExtractors<Resolver extends (...args: any[]) => any> {
    userId: (
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => string;
    userRoles: (
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => string[];
    revisionData: (
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => string;
    revisionTime?: (
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => string;
    knex: (
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => Knex;
    nodeId: (
        node: UnPromisify<ReturnType<Resolver>>,
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => INode['nodeId'] | undefined; // tslint:disable-line
    nodeSchemaVersion: number;
    nodeName: string;
    resolverOperation?: string;
    passThroughTransaction?: boolean;
    currentNodeSnapshot: (nodeId: INode['nodeId'], resolverArgs: Parameters<Resolver>) => any; // tslint:disable-line
    currentNodeSnapshotFrequency?: number;
    parentNode?: (
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => INode;
    edges?: (
        parent: Parameters<Resolver>[0],
        args: Parameters<Resolver>[1],
        ctx: Parameters<Resolver>[2],
        info: Parameters<Resolver>[3]
    ) => INode[];
}

export interface ICreateRevisionTransactionConfig extends INamesConfig {
    transactionTimeoutSeconds: number;
}

export interface IRevisionInfo {
    userId: string;
    userRoles?: string[];
    revisionData: string;
    revisionTime: string;
    nodeSchemaVersion: number;
    nodeName: string;
    edgesToRecord: INode[] | undefined;
    fragmentToRecord: INode | undefined;
    snapshotFrequency: number;
}

export interface INode {
    nodeId: number | string;
    nodeName: string;
}
