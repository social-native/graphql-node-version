import {getSqlDialectTranslator} from '../src';
import knex from 'knex';

export const getTxInsertId = async (k: knex, tx: knex.Transaction) => {
    const sqlTranslator = getSqlDialectTranslator(k);

    const {id} = await tx
        .select(tx.raw(`${sqlTranslator.lastInsertedId} as id`))
        .forUpdate()
        .first<{id: number | undefined}>();
    return id;
};
