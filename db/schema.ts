import { sqliteTable, text, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";
export const records = sqliteTable("records", {
  owner: text("owner").notNull(), id: text("id").notNull(),
  kind: text("kind").notNull(), code: text("code").notNull(),
  payload: text("payload").notNull(), updated: text("updated").notNull(),
}, t => [primaryKey({columns:[t.owner,t.id]}), uniqueIndex("records_owner_kind_code").on(t.owner,t.kind,t.code)]);
