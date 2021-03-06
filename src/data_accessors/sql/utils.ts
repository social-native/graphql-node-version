import Knex from 'knex';
import {getSqlDialectTranslator} from 'lib/sql_dialect_translator';

export const getTxInsertId = async (knex: Knex, tx: Knex.Transaction) => {
    const sqlTranslator = getSqlDialectTranslator(knex);

    const {id} = await tx
        .select(tx.raw(`${sqlTranslator.lastInsertedId} as id`))
        .forUpdate()
        .first<{id: number | undefined}>();
    return id;
};

export const createKnexTransaction = async (knex: Knex, transactionTimeoutSeconds?: number) => {
    const transaction = await knex.transaction();

    setTimeout(async () => {
        await transaction.rollback();
        // throw new Error('Detected an orphaned transaction');
    }, (transactionTimeoutSeconds || 10) * 1000);

    return transaction;
};
