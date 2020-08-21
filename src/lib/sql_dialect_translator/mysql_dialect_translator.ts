import {ISqlDialectTranslator} from './sql_dialect_translator';

const mysqlDialectTranslator: ISqlDialectTranslator = {
    lastInsertedId: 'last_insert_id()'
};

export default mysqlDialectTranslator;
