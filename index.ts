import { serve, version } from "bun";

const server = serve({
    port: 8080,
    hostname: "localhost",
    routes: {
        '/api/version': () => Response.json({ version: '1.0.0' })
    }
})

console.log(`Server is running at http://localhost:${server.port}`);
