import {INamesForTablesAndColumns} from 'types';
import inverseObject from './inverseObject';

export default (
    nodeToSqlNameMappings: INamesForTablesAndColumns,
    sqlData: {[column: string]: any}
) => {
    const {columnNames} = nodeToSqlNameMappings;
    const sqlToNodeNameMappings = inverseObject(columnNames) as {[key: string]: string};
    // const nodeNames = Object.keys(columnNames) as Array<keyof typeof columnNames>;
    // const sqlToNodeNameMappings = nodeNames.reduce(
    //     (inverseColumnNamesObj, nodeName: keyof typeof columnNames) => {
    //         const sqlName = columnNames[nodeName];
    //         inverseColumnNamesObj[sqlName] = nodeName;
    //         return inverseColumnNamesObj;
    //     },
    //     {} as {[sqlName: string]: keyof typeof columnNames}
    // );
    // const sqlToNodeNameMappings = inverseColumnNameMappings(nodeToSqlNameMappings);

    return Object.keys(sqlToNodeNameMappings).reduce(
        (nodeData, sqlName) => {
            const nodeName = sqlToNodeNameMappings[sqlName];
            const data = sqlData[sqlName];
            if (data) {
                nodeData[nodeName] = data;
            }
            return nodeData;
        },
        {} as {[column: string]: any} //as {[column in keyof typeof sqlToNodeNameMappings['columnNames']]: any}
    );
};
