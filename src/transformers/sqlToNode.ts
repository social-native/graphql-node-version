import {INamesForTablesAndColumns} from 'types';
import inverseObject from './inverseObject';

export default (
    nodeToSqlNameMappings: INamesForTablesAndColumns,
    sqlData: {[column: string]: any}
) => {
    const {columnNames} = nodeToSqlNameMappings;
    const sqlToNodeNameMappings = inverseObject(columnNames) as {[key: string]: string};
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
