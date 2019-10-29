import {UnPromisify} from '../types';

export default async <ResolverT extends (...args: any[]) => any>(
    doResolve: (...resolverArgs: any[]) => UnPromisify<ReturnType<ResolverT>>,
    args: Parameters<ResolverT>
) => {
    return await doResolve(...args);
};
