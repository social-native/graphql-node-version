import {INamesForTablesAndColumns} from 'types';

export default (
    nodeToSqlNameMappings: INamesForTablesAndColumns,
    sqlData: {[column: string]: any}
) => {
    const {columnNames} = nodeToSqlNameMappings;
    const nodeNames = Object.keys(columnNames) as Array<keyof typeof columnNames>;
    const sqlToNodeNameMappings = nodeNames.reduce(
        (inverseColumnNamesObj, nodeName: keyof typeof columnNames) => {
            const sqlName = columnNames[nodeName];
            inverseColumnNamesObj[sqlName] = nodeName;
            return inverseColumnNamesObj;
        },
        {} as {[sqlName: string]: keyof typeof columnNames}
    );

    return Object.keys(sqlToNodeNameMappings).reduce(
        (nodeData, sqlName) => {
            const nodeName = sqlToNodeNameMappings[sqlName];
            const data = sqlData[sqlName];
            if (data) {
                nodeData[nodeName] = data;
            }
            return nodeData;
        },
        {} as {[column: string]: any}
    );
};
