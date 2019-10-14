import {UnPromisify} from '../types';

export default async <ResolverT extends (...args: any[]) => any>(
    value: (
        ...resolverArgs: any[]
    ) => Promise<UnPromisify<ReturnType<ResolverT>>> | UnPromisify<ReturnType<ResolverT>>,
    args: Parameters<ResolverT>
) => {
    return await value(args[0], args[1], args[2], args[3]);
};
