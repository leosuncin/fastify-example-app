import { pgTable, integer, varchar, customType } from 'drizzle-orm/pg-core';

const citext = customType<{ data: string }>({
  dataType() {
    return 'citext';
  },
});

export const users = pgTable('users', {
  id: integer('user_id').primaryKey().generatedAlwaysAsIdentity(),
  username: citext('user_username').notNull().unique(),
  email: citext('user_email').notNull().unique(),
  password: varchar('user_password').notNull(),
  bio: varchar('user_bio').default(''),
  image: varchar('user_image'),
});

export type User = typeof users.$inferSelect;

export type NewUser = typeof users.$inferInsert;
