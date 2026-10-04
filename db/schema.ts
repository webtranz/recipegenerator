import { sqliteTable, text, integer, primaryKey, uniqueIndex, index } from "drizzle-orm/sqlite-core";
export const records = sqliteTable("records", {
  owner: text("owner").notNull(), id: text("id").notNull(),
  kind: text("kind").notNull(), code: text("code").notNull(),
  payload: text("payload").notNull(), updated: text("updated").notNull(),
  siteId: text("site_id").notNull().default(''),
}, t => [primaryKey({columns:[t.owner,t.id]}), uniqueIndex("records_owner_kind_code").on(t.owner,t.kind,t.code)]);
export const locations = sqliteTable('locations', {
  id:text('id').primaryKey(), kind:text('kind').notNull(), code:text('code').notNull(),
  name:text('name').notNull(), parentId:text('parent_id'), active:integer('active').notNull().default(1),
  updated:text('updated').notNull(),
}, t=>[uniqueIndex('locations_kind_code').on(t.kind,t.code),index('locations_parent').on(t.parentId)]);
export const users = sqliteTable('users', {
  id:text('id').primaryKey(),email:text('email').notNull(),name:text('name').notNull(),
  authUserId:text('auth_user_id'),role:text('role').notNull(),active:integer('active').notNull().default(1),
  updated:text('updated').notNull(),
}, t=>[uniqueIndex('users_email').on(t.email),uniqueIndex('users_auth_id').on(t.authUserId)]);
export const assignments = sqliteTable('user_sites', {
  userId:text('user_id').notNull().references(()=>users.id),siteId:text('site_id').notNull().references(()=>locations.id),
}, t=>[primaryKey({columns:[t.userId,t.siteId]})]);
