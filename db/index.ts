import { SQL } from "bun";

const pg = new SQL("postgres://admin:password123@localhost:5432/mydb");
await pg`SELECT ...`;
