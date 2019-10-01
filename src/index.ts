// enum KNEX_SQL_TYPES {
//     'MYSQL',
//     'SQLITE'
// }
// const knexSqlType = (knex: Knex) => {
//     const MYSQL_CLIENTS = ['mysql', 'mysql2'];
//     const SQLITE_CLIENTS = ['sqlite3'];
//     const {client: clientName} = (knex as any).client.config;
//     if (MYSQL_CLIENTS.includes(clientName)) {
//         return KNEX_SQL_TYPES.MYSQL;
//     } else if (SQLITE_CLIENTS.includes(clientName)) {
//         return KNEX_SQL_TYPES.SQLITE;
//     } else {
//         throw new Error('Unknown SQL client');
//     }
// };

// const selectLastInsertId = (knex: Knex) => {
//     const sqlType = knexSqlType(knex);
//     if (sqlType === KNEX_SQL_TYPES.MYSQL) {
//         return knex.s
//     }
// };

// tslint:disable

// export {createRevisionMigrations, createRevisionTransaction, versionRecorderDecorator};
export {default as versionConnectionDecorator} from './decorators/versionConnection';
export {default as versionRecorderDecorator} from './decorators/version_recorder/index';
export {default as createRevisionMigrations} from './migrations/generator';
export {default as decorate} from './lib/mobx/decorate';
export * from './types';
