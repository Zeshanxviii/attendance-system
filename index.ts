import { serve, version } from "bun";
// import { checkDatabase } from "./db";
import { drizzle } from 'drizzle-orm/node-postgres';
import { signUpHandler } from "./routes/auth/auth";

// connecting drizzle orm to database !
export const db = drizzle(process.env.DATABASE_URL!);

// await checkDatabase();
const server = serve({
    port: 8080,
    hostname: "localhost",
    routes: {
        '/api/version': () => Response.json({ version: '1.0.0' }),
        '/api/signup': signUpHandler
    }
})

console.log(`Server is running at http://localhost:${server.port}`);
