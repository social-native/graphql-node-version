import {IVersionRecorderExtractors} from '../types';

export default <T extends (...args: any[]) => any>(
    extractors: IVersionRecorderExtractors<T>,
    property: string | symbol
) => {
    const rawResolverOperation = extractors.resolverOperation
        ? extractors.resolverOperation
        : property;

    return typeof rawResolverOperation === 'symbol'
        ? rawResolverOperation.toString()
        : rawResolverOperation;
};
