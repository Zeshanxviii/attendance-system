// import { eventBus } from "../..";
import { attendanceManager } from "../..";
// import { createRoom } from "../../services/createRoom";


interface User {
    id: string;
    email: string;
    role: 'teacher' | 'student';
    name: string;
}
// export async function createRoomController(req: Request): Promise<Response> {
//     // todo // add validation so that no duplicate entry 
//     // this should be protected route only accessible to authenticated users
//     try {
//         if (req.method !== "POST") {
//             return new Response(
//                 JSON.stringify({ message: "Method not allowed" }),
//                 { status: 405, headers: { "Content-Type": "application/json" } }
//             );
//         }

//         const body = await req.json() as {
//             name: string;
//             capacity: string | number;
//         };

//         const { name, capacity } = body;

//         // basic validation
//         if (!name || !capacity) {
//             return new Response(
//                 JSON.stringify({ message: "Missing fields" }),
//                 { status: 400, headers: { "Content-Type": "application/json" } }
//             );
//         }

//         // convert capacity to number if needed
//         const room = await createRoom({
//             name,
//             capacity: typeof capacity === "string" ? parseInt(capacity) : capacity,
//         });

//         // 🔔 publish event
//         eventBus.emit("room.created", room);

//         return new Response(JSON.stringify(room), {
//             status: 201,
//             headers: { "Content-Type": "application/json" },
//         });
//     } catch (error) {
//         console.error(error);
//         return new Response(
//             JSON.stringify({ message: "Internal server error" }),
//             { status: 500, headers: { "Content-Type": "application/json" } }
//         );
//     }
// }


export async function createRoomController(req: Request) {
    //   const teacher = await getTeacherFromAuth(req);

    const body = await req.json() as {
        name: string;
        duration: number;
        requireLocation: boolean;
        location?: {
            latitude: number;
            longitude: number;
            radius: number;
        };
    };

    // basic validation
    if (!body.name || !body.duration) {
        return Response.json({ message: "Missing fields" }, { status: 400 });
    }

    // if (req.headers.get('x-user-role') !== 'teacher') {
    //     return Response.json({ message: "Only teachers can create rooms" }, { status: 403 });
    // }

    const role = req.headers.get('x-user-role') as 'teacher' | 'student';

    const teacher: User = {
        id: req.headers.get('x-user-id') || 'unknown',
        email: req.headers.get('x-user-email') || 'unknown',
        role: 'teacher',
        name: req.headers.get('x-user-name') || 'unknown'
    };

    const room = attendanceManager.createRoom(teacher, {
        name: body.name,
        duration: body.duration,
        requireLocation: body.requireLocation,
        location: body.location
    });

    return Response.json(room, { status: 201 });
}
