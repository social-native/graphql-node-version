import Knex from 'knex';
import mysqlDialectTranslator from './mysql_dialect_translator';
import sqliteDialectTranslator from './sqlite_translator_dialect';

export interface ISqlDialectTranslator {
    lastInsertedId: string;
}

export default function getSqlDialectTranslator(knex: Knex): ISqlDialectTranslator {
    const {client} = knex.client.config;

    if (['mysql', 'mysql2'].includes(client)) {
        return mysqlDialectTranslator;
    }

    if (client === 'sqlite3') {
        return sqliteDialectTranslator;
    }

    throw new Error('Unsupported SQL Dialect');
}
