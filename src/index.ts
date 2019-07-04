import * as Knex from 'knex';

/**
 * Sets the names for tables and columns that revisions will be stored in
 */
interface INamesConfig {
    tableNames?: {main?: string; roles?: string};
    columnNames?: {
        userId?: string;
        userRoles?: string;
        revisionData?: string;
        revisionTime?: string;
        nodeVersion?: string;
        nodeName?: string;
    };
}

interface INamesForTablesAndColumns {
    tableNames: {main: string; roles: string};
    columnNames: {
        userId: string;
        userRoles: string;
        revisionData: string;
        revisionTime: string;
        nodeVersion: string;
        nodeName: string;
    };
}

const setNames = ({tableNames, columnNames}: INamesConfig): INamesForTablesAndColumns => ({
    tableNames: {
        main: 'revisions',
        roles: 'roles',
        ...tableNames
    },
    columnNames: {
        userId: 'user_id',
        userRoles: 'user_roles',
        revisionData: 'revision',
        revisionTime: 'created_at',
        nodeVersion: 'node_version',
        nodeName: 'node_name',
        ...columnNames
    }
});

/**
 * Crates a table for storing revisions
 */
interface IConfig extends INamesConfig {
    roles: string[];
}

const createRevisionMigrations = (config?: IConfig) => {
    const {tableNames, columnNames} = setNames(config || {});

    const up = async (knex: Knex) => {
        return await knex.schema.createTable(tableNames.main, t => {
            t.increments('id')
                .unsigned()
                .primary();
            t.timestamp(columnNames.revisionTime).defaultTo(knex.fn.now());

            t.string(columnNames.userId);
            t.json(columnNames.revisionData);
            t.string(columnNames.nodeName);
            t.integer(columnNames.nodeVersion);
        });
    };

    const down = async (knex: Knex) => {
        return await knex.schema.dropTable(tableNames.main);
    };

    return {up, down};
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

const createRevisionTransaction = (config?: ICreateRevisionTransactionConfig) => async (
    knex: Knex,
    input: IRevisionInput
): Promise<{transaction: Knex.Transaction}> => {
    const transaction = await knex.transaction();
    const {tableNames} = setNames(config || {});
    setTimeout(async () => {
        await transaction.rollback();

        throw new Error('Detected an orphaned transaction');
    }, ((config && config.transactionTimeoutSeconds) || 10) * 1000);

    knex(tableNames.main)
        .transacting(transaction)
        .insert(input);

    return {transaction};
};

export {createRevisionMigrations, createRevisionTransaction};
export {default as decorate} from './lib/mobx/decorate';
