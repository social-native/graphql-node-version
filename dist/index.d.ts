import * as Knex from 'knex';
/**
 * Sets the names for tables and columns that revisions will be stored in
 */
interface INamesConfig {
    tableNames?: {
        main?: string;
        roles?: string;
    };
    columnNames?: {
        userId?: string;
        userRoles?: string;
        revisionData?: string;
        revisionTime?: string;
        nodeVersion?: string;
        nodeName?: string;
    };
}
/**
 * Crates a table for storing revisions
 */
interface IConfig extends INamesConfig {
    roles: string[];
}
declare const createRevisionMigrations: (config?: IConfig | undefined) => {
    up: (knex: Knex<any, any[]>) => Knex.SchemaBuilder;
    down: (knex: Knex<any, any[]>) => Knex.SchemaBuilder;
};
/**
 * Writes a transaction for storing revision to the revision table
 */
interface IRevisionInput {
    userId?: string;
    userRoles?: string;
    revisionData?: string;
    revisionTime?: string;
    nodeVersion?: number;
    nodeName?: string;
}
interface ICreateRevisionTransactionConfig extends INamesConfig {
    transactionTimeoutSeconds: number;
}
declare const createRevisionTransaction: (config?: ICreateRevisionTransactionConfig | undefined) => (knex: Knex<any, any[]>, input: IRevisionInput) => Promise<{
    transaction: Knex.Transaction<any, any>;
}>;
export { createRevisionMigrations, createRevisionTransaction };
