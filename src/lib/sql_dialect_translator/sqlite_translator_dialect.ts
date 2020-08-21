import {ISqlDialectTranslator} from './sql_dialect_translator';

const sqliteDialectTranslator: ISqlDialectTranslator = {
    lastInsertedId: 'last_insert_rowid()'
};

export default sqliteDialectTranslator;
