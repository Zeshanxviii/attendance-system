import { integer, pgEnum, pgTable, varchar } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["student", "teacher"]);

export const usersTable = pgTable(
  "users",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 255 }).notNull(),
    age: integer().notNull(),
    email: varchar({ length: 255 }).notNull().unique(),
    password: varchar({ length: 255 }).notNull(),
    role: roleEnum().notNull(),
  },
  (table) => ({
    schema: "public", // explicitly assign schema
  })
);
