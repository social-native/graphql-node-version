exports.up = function(knex, Promise) {
    return knex.schema.createTable('team', (t) => {
        t.increments('id').unsigned().primary();
        t.timestamp('created_at').defaultTo(knex.fn.now())
        t.timestamp('updated_at').nullable().defaultTo(knex.raw('current_timestamp() ON UPDATE current_timestamp()'));
        t.timestamp('deleted_at').nullable();

        t.string('name');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema
        .dropTable('team');
};
