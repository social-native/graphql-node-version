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

const DEFAULT_TABLE_NAMES = {
    main: 'revisions',
    roles: 'roles'
};

const DEFAULT_COLUMN_NAMES = {
    userId: 'user_id',
    userRoles: 'user_roles',
    revisionData: 'revision',
    revisionTime: 'created_at',
    nodeVersion: 'node_version',
    nodeName: 'node_name'
};

const setNames = ({tableNames, columnNames}: INamesConfig): INamesForTablesAndColumns => ({
    tableNames: {
        ...DEFAULT_TABLE_NAMES,
        ...tableNames
    },
    columnNames: {
        ...DEFAULT_COLUMN_NAMES,
        ...columnNames
    }
});

interface IWriteableData {
    tableData?: {
        main?: string;
        roles?: string;
    };
    columnData?: {
        userId?: string;
        userRoles?: string;
        revisionData?: string;
        revisionTime?: string;
        nodeVersion?: number;
        nodeName?: string;
    };
}

interface ITransformInput {
    columnNames: NonNullable<INamesForTablesAndColumns['columnNames']> & {[column: string]: any};
    columnData: NonNullable<IWriteableData['columnData']> & {[column: string]: any};
}
const transformInput = ({columnNames, columnData}: ITransformInput) => {
    return Object.keys(columnNames || {}).reduce(
        (newColumnDataObj, columnName) => {
            const newColumnName = columnNames[columnName];
            const data = columnData[columnName];
            if (data) {
                newColumnDataObj[newColumnName] = data;
            }
            return newColumnDataObj;
        },
        {} as IWriteableData['columnData'] & {[column: string]: any}
    );
};

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
export interface IRevisionInput {
    userId?: string;
    userRoles?: string;
    revisionData?: string;
    revisionTime?: string;
    nodeVersion?: number;
    nodeName?: string;
}

export interface IVersionSetupExtractors<Resolver extends (...args: any[]) => any> {
    userId: (...args: Parameters<Resolver>) => string;
    userRoles: (...args: Parameters<Resolver>) => string;
    revisionData: (...args: Parameters<Resolver>) => string;
    revisionTime: (...args: Parameters<Resolver>) => string;
    nodeVersion: (...args: Parameters<Resolver>) => number;
    nodeName: (...args: Parameters<Resolver>) => string;
    knex: (...args: Parameters<Resolver>) => Knex;
}

interface ICreateRevisionTransactionConfig extends INamesConfig {
    transactionTimeoutSeconds: number;
}

const createRevisionTransaction = (
    config?: ICreateRevisionTransactionConfig & INamesConfig
) => async (knex: Knex, input: IRevisionInput): Promise<{transaction: Knex.Transaction}> => {
    const transaction = await knex.transaction();
    const {tableNames, columnNames} = setNames(config || {});
    const {userRoles, ...mainTableInput} = input;
    const transformedMainTableInput = transformInput({columnNames, columnData: mainTableInput});
    console.log('transformed input', transformedMainTableInput);
    setTimeout(async () => {
        await transaction.rollback();

        throw new Error('Detected an orphaned transaction');
    }, ((config && config.transactionTimeoutSeconds) || 10) * 1000);

    console.log('inside', input);
    await knex(tableNames.main)
        // .transacting(transaction)
        .insert(transformedMainTableInput);

    await transaction.commit();
    // console.log(transaction.toString());

    return {transaction};
};

export {createRevisionMigrations, createRevisionTransaction};
export {default as decorate} from './lib/mobx/decorate';
export * from './types';
