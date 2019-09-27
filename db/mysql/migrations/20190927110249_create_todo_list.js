exports.up = function(knex, Promise) {
    return knex.schema.createTable('todo_list', (t) => {
        t.increments('id').unsigned().primary();
        t.timestamp('created_at').defaultTo(knex.fn.now())
        t.timestamp('updated_at').nullable();
        t.timestamp('deleted_at').nullable();

        t.string('usage').notNullable();
    });
};

exports.down = function(knex, Promise) {
    return knex.schema
        .dropTable('todo_list');
};
