exports.up = function(knex, Promise) {
    return knex.schema.createTable('team_user', (t) => {
        t.increments('id').unsigned().primary();
        t.timestamp('created_at').defaultTo(knex.fn.now())
        t.timestamp('updated_at').nullable();
        t.timestamp('deleted_at').nullable();

        t.integer('team_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('team');

        t.integer('user_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('user');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema
        .dropTable('team_user');
};
