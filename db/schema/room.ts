// db/schema/rooms.ts
import { pgTable, integer, varchar } from "drizzle-orm/pg-core";

export const roomsTable = pgTable("rooms", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 255 }).notNull(),
    capacity: integer().notNull(),
});