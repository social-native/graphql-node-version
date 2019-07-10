import * as Knex from 'knex';
import {UnPromisify} from '../types';

export interface IVersionConnectionExtractors<Resolver extends (...args: any[]) => any> {
    knex: (...args: Parameters<Resolver>) => Knex;
}

export default <ResolverT extends (...args: any[]) => any>(
    extractors: IVersionConnectionExtractors<ResolverT>
    // config?: ICreateRevisionTransactionConfig & INamesConfig
): MethodDecorator => {
    return (_target, _property, descriptor: TypedPropertyDescriptor<any>) => {
        // const {tableNames, columnNames} = setNames(config || {});
        const {value} = descriptor;
        if (typeof value !== 'function') {
            throw new TypeError('Only functions can be decorated.');
        }

        // if (!extractors.nodeIdCreate && !extractors.nodeIdUpdate) {
        //     throw new Error(
        //         // tslint:disable-next-line
        //         'No node id extractor specified in the config. You need to specify either a `nodeIdUpdate` or `nodeIdCreate` extractor'
        //     );
        // }

        // tslint:disable-next-line
        descriptor.value = (async (...args) => {
            const localKnexClient =
                extractors.knex && extractors.knex(...(args as Parameters<ResolverT>));
            console.log(localKnexClient);
            // const userId =
            //     extractors.userId && extractors.userId(...(args as Parameters<ResolverT>));
            // const userRoles = extractors.userRoles
            //     ? extractors.userRoles(...(args as Parameters<ResolverT>))
            //     : [];
            // const revisionData =
            //     extractors.revisionData &&
            //     extractors.revisionData(...(args as Parameters<ResolverT>));
            // const revisionTime = extractors.revisionTime
            //     ? extractors.revisionTime(...(args as Parameters<ResolverT>))
            //     : new Date()
            //           .toISOString()
            //           .split('Z')
            //           .join('');
            // const nodeVersion =
            //     extractors.nodeVersion &&
            //     extractors.nodeVersion(...(args as Parameters<ResolverT>));
            // const nodeName = extractors.nodeName
            //     ? extractors.nodeName(...(args as Parameters<ResolverT>))
            //     : property;
            // let nodeId = extractors.nodeIdUpdate
            //     ? extractors.nodeIdUpdate(...(args as Parameters<ResolverT>))
            //     : undefined;

            // const revisionInput = {
            //     userId,
            //     userRoles,
            //     revisionData,
            //     revisionTime,
            //     nodeVersion,
            //     nodeName: typeof nodeName === 'symbol' ? nodeName.toString() : nodeName,
            //     nodeId
            // };

            // const revTxFn = createRevisionTransaction(config);
            // const {transaction, revisionId} = await revTxFn(localKnexClient, revisionInput);

            const [parent, ar, ctx, info] = args;
            // const newArgs = {...ar, transaction};
            const node = (await value(parent, ar, ctx, info)) as UnPromisify<ReturnType<ResolverT>>;

            // if (!nodeId) {
            //     nodeId = extractors.nodeIdCreate ? extractors.nodeIdCreate(node) : undefined;
            //     await localKnexClient
            //         .table(tableNames.revision)
            //         .update({[columnNames.nodeId]: nodeId})
            //         .where({id: revisionId});
            // }

            return node;
        }) as ResolverT;

        return descriptor;
    };
};
