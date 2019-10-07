import Knex from 'knex';
import {IVersionConnectionInfo, ITableAndColumnNames} from 'types';

export default async <ResolverT extends (...args: any[]) => any>(
    knex: Knex,
    {table_names, event_node_fragment_register}: ITableAndColumnNames,
    originalNodeInstance: IVersionConnectionInfo<ResolverT>
): Promise<Array<Pick<IVersionConnectionInfo<ResolverT>, 'nodeId' | 'nodeName'>>> => {
    const allNodeInstancesInConnection = (await knex
        .table(table_names.event_node_fragment_register)
        .andWhere({
            [`${table_names.event_node_fragment_register}.${event_node_fragment_register.parent_node_id}`]: originalNodeInstance.nodeId, // tslint:disable-line
            [`${table_names.event_node_fragment_register}.${event_node_fragment_register.parent_node_name}`]: originalNodeInstance.nodeName // tslint:disable-line
        })
        .select(
            `${table_names.event_node_fragment_register}.${event_node_fragment_register.child_node_id} as nodeId`,
            `${table_names.event_node_fragment_register}.${event_node_fragment_register.child_node_name} as nodeName`
        )) as Array<{nodeId: number; nodeName: string}>;

    return allNodeInstancesInConnection;
};
