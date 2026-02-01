import { attendanceManager } from "../../instances";
// import { createRoom } from "../../services/createRoom";


interface User {
    id: string;
    email: string;
    role: 'teacher' | 'student';
    name: string;
}

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
