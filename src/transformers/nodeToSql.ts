import {INamesForTablesAndColumns} from 'types';

export default (
    nodeToSqlNameMappings: INamesForTablesAndColumns,
    nodeData: {[column: string]: any}
) => {
    const {columnNames} = nodeToSqlNameMappings;
    const nodeNames = Object.keys(columnNames) as Array<keyof typeof columnNames>;
    return nodeNames.reduce(
        (sqlData, nodeName) => {
            const sqlName = columnNames[nodeName];
            const data = nodeData[nodeName];
            if (data) {
                sqlData[sqlName] = data;
            }
            return sqlData;
        },
        {} as {[column: string]: any}
    );
};
