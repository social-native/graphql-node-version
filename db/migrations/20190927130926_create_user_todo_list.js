exports.up = function(knex, Promise) {
    return knex.schema.createTable('user_todo_list', (t) => {
        t.increments('id').unsigned().primary();
        t.timestamp('created_at').defaultTo(knex.fn.now())
        t.timestamp('updated_at').nullable().defaultTo(knex.fn.now())
        t.timestamp('deleted_at').nullable();

        t.integer('user_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('user')
            .onDelete('CASCADE');

        t.integer('todo_list_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('todo_list')
            .onDelete('CASCADE');

    });
};

exports.down = function(knex, Promise) {
    return knex.schema
        .dropTable('user_todo_list');
};
