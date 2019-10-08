import Knex from 'knex';
import {IVersionConnectionInfo, ITableAndColumnNames, ILoggerConfig} from 'types';
import {getLoggerFromConfig} from 'logger';

export default async <ResolverT extends (...args: any[]) => any>(
    knex: Knex,
    {table_names, event_node_fragment_register}: ITableAndColumnNames,
    originalNodeInstance: Pick<IVersionConnectionInfo<ResolverT>, 'nodeId' | 'nodeName'>,
    loggerConfig?: ILoggerConfig
): Promise<Array<Pick<IVersionConnectionInfo<ResolverT>, 'nodeId' | 'nodeName'>>> => {
    const parentLogger = getLoggerFromConfig(loggerConfig);
    const logger = parentLogger.child({query: 'Node instances in connection'});

    const query = knex
        .table(table_names.event_node_fragment_register)
        .andWhere({
            [`${table_names.event_node_fragment_register}.${event_node_fragment_register.parent_node_id}`]: originalNodeInstance.nodeId, // tslint:disable-line
            [`${table_names.event_node_fragment_register}.${event_node_fragment_register.parent_node_name}`]: originalNodeInstance.nodeName // tslint:disable-line
        })
        .select(
            `${table_names.event_node_fragment_register}.${event_node_fragment_register.child_node_id} as nodeId`,
            `${table_names.event_node_fragment_register}.${event_node_fragment_register.child_node_name} as nodeName`
        );

    logger.debug('Raw SQL:', query.toQuery());

    return (await query) as Array<{nodeId: number; nodeName: string}>;
};
