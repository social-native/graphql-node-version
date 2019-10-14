exports.up = function(knex, Promise) {
    return knex.schema.createTable('team_user', (t) => {
        t.increments('id').unsigned().primary();
        t.timestamp('created_at').defaultTo(knex.fn.now())
        t.timestamp('updated_at').nullable().defaultTo(knex.raw('current_timestamp() ON UPDATE current_timestamp()'));
        t.timestamp('deleted_at').nullable();

        t.integer('team_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('team')
            .onDelete('CASCADE');


        t.integer('user_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('user')
            .onDelete('CASCADE');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema
        .dropTable('team_user');
};
