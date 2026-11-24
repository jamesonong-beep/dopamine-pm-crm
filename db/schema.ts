import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const workspaces = sqliteTable('workspaces', {owner: text('owner').primaryKey(), revision: integer('revision').notNull().default(0), data: text('data').notNull()});
export const recoveryPoints = sqliteTable('recovery_points', {id:text('id').primaryKey(),owner:text('owner').notNull(),createdAt:text('created_at').notNull(),kind:text('kind').notNull(),revision:integer('revision').notNull(),data:text('data').notNull()});
export const securityEvents = sqliteTable('security_events', {id:text('id').primaryKey(),owner:text('owner').notNull(),actor:text('actor').notNull(),at:text('at').notNull(),action:text('action').notNull(),detail:text('detail').notNull()});
export const requestLimits = sqliteTable('request_limits', {key:text('key').primaryKey(),window:integer('window').notNull(),count:integer('count').notNull()});
