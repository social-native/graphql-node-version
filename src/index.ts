import * as Knex from 'knex';

/**
 * Sets the names for tables and columns that revisions will be stored in
 */
interface INamesConfig {
    tableNames?: {revision?: string; role?: string; revisionRole?: string};
    columnNames?: {
        userId?: string;
        userRoles?: string;
        revisionData?: string;
        revisionTime?: string;
        nodeVersion?: string;
        nodeName?: string;
        roleName?: string;
    };
}

interface INamesForTablesAndColumns {
    tableNames: {revision: string; role: string; revisionRole: string};
    columnNames: {
        userId: string;
        userRoles: string;
        revisionData: string;
        revisionTime: string;
        nodeVersion: string;
        nodeName: string;
        roleName: string;
    };
}

const DEFAULT_TABLE_NAMES = {
    revision: 'revision',
    role: 'role',
    revisionRole: 'revision_roles'
};

const DEFAULT_COLUMN_NAMES = {
    userId: 'user_id',
    userRoles: 'user_roles',
    revisionData: 'revision',
    revisionTime: 'created_at',
    nodeVersion: 'node_version',
    nodeName: 'node_name',
    roleName: 'role_name'
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
        revision?: string;
        role?: string;
    };
    columnData?: {
        userId?: string;
        userRoles?: string[];
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
 * Crates a table for storing revision
 */
interface IConfig extends INamesConfig {
    role: string[];
}

const createRevisionMigrations = (config?: IConfig) => {
    const {tableNames, columnNames} = setNames(config || {});

    const up = async (knex: Knex) => {
        const revision = await knex.schema.createTable(tableNames.revision, t => {
            t.increments('id')
                .unsigned()
                .primary();
            t.timestamp(columnNames.revisionTime).defaultTo(knex.fn.now());

            t.string(columnNames.userId);
            t.json(columnNames.revisionData);
            t.string(columnNames.nodeName);
            t.integer(columnNames.nodeVersion);
        });

        if (tableNames.role && tableNames.revisionRole) {
            await knex.schema.createTable(tableNames.role, t => {
                t.string(columnNames.roleName)
                    .unsigned()
                    .notNullable()
                    .unique();
            });

            return await knex.schema.createTable(tableNames.revisionRole, t => {
                t.integer(`${tableNames.revision}_id`)
                    .unsigned()
                    .notNullable()
                    .references('id')
                    .inTable(tableNames.revision);
                t.integer(`${tableNames.role}_id`)
                    .unsigned()
                    .notNullable()
                    .references('id')
                    .inTable(tableNames.role);
            });
        } else {
            return revision;
        }
    };

    const down = async (knex: Knex) => {
        const revision = await knex.schema.dropTable(tableNames.revision);
        if (tableNames.role && tableNames.revisionRole) {
            await knex.schema.dropTable(tableNames.role);
            return await knex.schema.dropTable(tableNames.revisionRole);
        } else {
            return revision;
        }
    };

    return {up, down};
};

/**
 * Writes a transaction for storing revision to the revision table
 */
export interface IRevisionInput {
    userId?: string;
    userRoles?: string[];
    revisionData?: string;
    revisionTime?: string;
    nodeVersion?: number;
    nodeName?: string;
}

export interface IVersionSetupExtractors<Resolver extends (...args: any[]) => any> {
    userId: (...args: Parameters<Resolver>) => string;
    userRoles: (...args: Parameters<Resolver>) => string[];
    revisionData: (...args: Parameters<Resolver>) => string;
    revisionTime?: (...args: Parameters<Resolver>) => string;
    nodeVersion: (...args: Parameters<Resolver>) => number;
    nodeName?: (...args: Parameters<Resolver>) => string;
    knex: (...args: Parameters<Resolver>) => Knex;
}

interface ICreateRevisionTransactionConfig extends INamesConfig {
    transactionTimeoutSeconds: number;
}

const createRevisionTransaction = (
    config?: ICreateRevisionTransactionConfig & INamesConfig
) => async (knex: Knex, input: IRevisionInput): Promise<{transaction: Knex.Transaction}> => {
    const {tableNames, columnNames} = setNames(config || {});
    const {userRoles, ...mainTableInput} = input;
    const transformedMainTableInput = transformInput({columnNames, columnData: mainTableInput});

    const transaction = await knex.transaction();
    await transaction.table(tableNames.revision).insert(transformedMainTableInput);
    setTimeout(async () => {
        await transaction.rollback();
        // throw new Error('Detected an orphaned transaction');
    }, ((config && config.transactionTimeoutSeconds) || 10) * 1000);

    return {transaction};
};

const versionedTransactionDecorator = <ResolverT extends (...args: any[]) => any>(
    extractors: IVersionSetupExtractors<ResolverT>,
    revisionTx?: ReturnType<typeof createRevisionTransaction>
): MethodDecorator => {
    return (_target, property, descriptor: TypedPropertyDescriptor<any>) => {
        const {value} = descriptor;
        if (typeof value !== 'function') {
            throw new TypeError('Only functions can be decorated.');
        }

        // tslint:disable-next-line
        descriptor.value = (async (...args) => {
            const localKnexClient =
                extractors.knex && extractors.knex(...(args as Parameters<ResolverT>));
            const userId =
                extractors.userId && extractors.userId(...(args as Parameters<ResolverT>));
            const userRoles = extractors.userRoles
                ? extractors.userRoles(...(args as Parameters<ResolverT>))
                : [];
            const revisionData =
                extractors.revisionData &&
                extractors.revisionData(...(args as Parameters<ResolverT>));
            const revisionTime = extractors.revisionTime
                ? extractors.revisionTime(...(args as Parameters<ResolverT>))
                : new Date()
                      .toISOString()
                      .split('Z')
                      .join('');
            const nodeVersion =
                extractors.nodeVersion &&
                extractors.nodeVersion(...(args as Parameters<ResolverT>));
            const nodeName = extractors.nodeName
                ? extractors.nodeName(...(args as Parameters<ResolverT>))
                : property;

            const revisionInput = {
                userId,
                userRoles,
                revisionData,
                revisionTime,
                nodeVersion,
                nodeName: typeof nodeName === 'symbol' ? nodeName.toString() : nodeName
            };

            const revTxFn = revisionTx ? revisionTx : createRevisionTransaction();
            const {transaction} = await revTxFn(localKnexClient, revisionInput);

            const [parent, ar, ctx, info] = args;
            const newArgs = {...ar, transaction};
            return (await value(parent, newArgs, ctx, info)) as ReturnType<ResolverT>;
        }) as ResolverT;

        return descriptor;
    };
};
// tslint:disable

export {createRevisionMigrations, createRevisionTransaction, versionedTransactionDecorator};
export {default as decorate} from './lib/mobx/decorate';
export * from './types';
