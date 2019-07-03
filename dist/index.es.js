const setNames = ({ tableNames, columnNames }) => ({
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
const createRevisionMigrations = (config) => {
    const { tableNames, columnNames } = setNames(config || {});
    const up = async (knex) => {
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
    const down = async (knex) => {
        return await knex.schema.dropTable(tableNames.main);
    };
    return { up, down };
};
const createRevisionTransaction = (config) => async (knex, input) => {
    const transaction = await knex.transaction();
    const { tableNames } = setNames(config || {});
    setTimeout(async () => {
        await transaction.rollback();
        throw new Error('Detected an orphaned transaction');
    }, ((config && config.transactionTimeoutSeconds) || 10) * 1000);
    knex(tableNames.main)
        .transacting(transaction)
        .insert(input);
    return { transaction };
};

export { createRevisionMigrations, createRevisionTransaction };
