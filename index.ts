import { EventEmitter } from "events";
import type { ServerWebSocket } from "bun";
import { drizzle } from 'drizzle-orm/node-postgres';
import { loginHandler, signUpHandler } from "./routes/auth/auth";
import { createRoomController } from "./routes/room/room";
import { AttendanceManager, setupAttendanceWebSocket } from "./services/attendance-manager/manager";
import type { WebSocketData } from "./services/attendance-manager/manager";

export const db = drizzle(process.env.DATABASE_URL!);

// create event bus before wiring websocket
export const eventBus = new EventEmitter();
export const attendanceManager = new AttendanceManager(eventBus);
eventBus.setMaxListeners(50);

// simple in-memory user lookup for WebSocket auth (replace with real lookup)
const users = new Map<string, any>([
    ['teacher:1', { id: 'teacher:1', email: 't1@example.com', role: 'teacher', name: 'Teacher One' }],
    ['student:1', { id: 'student:1', email: 's1@example.com', role: 'student', name: 'Student One' }]
]);
async function getUserById(id: string | undefined) {
    if (!id) return null;
    return users.get(id) ?? null;
}

// wire attendance websocket handlers
const { server: attendanceWS, manager: attendanceManagers } = setupAttendanceWebSocket(eventBus, getUserById);

// await checkDatabase();
const server = Bun.serve({
    port: 8080,
    hostname: "localhost",
    routes: {
        '/api/version': () => Response.json({ version: '1.0.0' }),
        '/api/signup': {
            POST: signUpHandler
        },
        '/api/login': {
            POST: loginHandler
        },
        '/api/room': {
            POST: createRoomController
        },

    },
    fetch(req, server) {
        if (server.upgrade(req)) {
            return;
        }
        return new Response("Not Found", { status: 404 })
    },

    // integrate websocket handlers from manager
    websocket: {
        open(ws) {
            try {
                // treat incoming ws as the manager's typed websocket
                const socket = ws as unknown as ServerWebSocket<WebSocketData> & { request?: Request };
                const headerId = socket.request?.headers.get('x-user-id');
                const queryId = socket.request?.url ? new URL(socket.request.url).searchParams.get('userId') : null;
                socket.data = socket.data ?? ({} as WebSocketData);
                if (headerId) socket.data.userId = headerId;
                else if (queryId) socket.data.userId = queryId;
            } catch (e) {
                // ignore and let manager handle missing userId
            }

            // delegate to manager open if present
            attendanceWS.websocket.open?.(ws as unknown as ServerWebSocket<WebSocketData>);
        },

        // cast to any to avoid incompatibility between Bun's declared generic and our WebSocketData generic
        message: (attendanceWS.websocket as any).message?.bind(attendanceWS.websocket),
        close: (attendanceWS.websocket as any).close?.bind(attendanceWS.websocket)
    }
})

console.log(`Server is running at http://localhost:${server.port}`);

