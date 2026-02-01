import { EventEmitter } from "events";
import type { ServerWebSocket } from "bun";

interface User {
    id: string;
    email: string;
    role: 'teacher' | 'student';
    name: string;
}

interface Room {
    id: string;
    code: string;
    teacherId: string;
    name: string;
    status: 'active' | 'closed';
    createdAt: Date;
    expiresAt: Date;
    location?: {
        latitude: number;
        longitude: number;
        radius: number; // in meters
    };
    settings: {
        requireLocation: boolean;
        allowLateJoin: boolean;
        autoCloseAfter: number; // minutes
    };
}

interface AttendanceRecord {
    id: string;
    roomId: string;
    studentId: string;
    markedAt: Date;
    location?: {
        latitude: number;
        longitude: number;
    };
    status: 'present' | 'late' | 'absent';
}

export interface WebSocketData {
    userId: string;
    role: 'teacher' | 'student';
    roomId?: string;
}

type WSMessage =
    | { type: 'join_room'; roomCode: string; location?: { latitude: number; longitude: number } }
    | { type: 'mark_attendance'; location?: { latitude: number; longitude: number } }
    | { type: 'close_room' }
    | { type: 'get_attendance_list' }
    | { type: 'ping' };

type WSResponse =
    | { type: 'room_joined'; room: Room; students: AttendanceRecord[] }
    | { type: 'attendance_marked'; record: AttendanceRecord }
    | { type: 'room_closed'; roomId: string }
    | { type: 'attendance_list'; records: AttendanceRecord[] }
    | { type: 'student_joined'; student: { id: string; name: string } }
    | { type: 'error'; message: string; code: string }
    | { type: 'pong' };

// ============================================
// ATTENDANCE MANAGER (Business Logic)
// ============================================

export class AttendanceManager {
    private rooms: Map<string, Room> = new Map();
    private attendance: Map<string, AttendanceRecord[]> = new Map();
    private roomConnections: Map<string, Set<ServerWebSocket<WebSocketData>>> = new Map();
    private eventBus: EventEmitter;

    constructor(eventBus: EventEmitter) {
        this.eventBus = eventBus;
        this.startCleanupTask();
    }

    // ============================================
    // TEACHER FUNCTIONS
    // ============================================

    createRoom(teacher: User, config: {
        name: string;
        duration: number;
        location?: { latitude: number; longitude: number; radius: number };
        requireLocation?: boolean;
        allowLateJoin?: boolean;
    }): Room {
        if (teacher.role !== 'teacher') {
            throw new Error('Only teachers can create rooms');
        }

        const roomCode = this.generateRoomCode();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + config.duration * 60000);

        const room: Room = {
            id: crypto.randomUUID(),
            code: roomCode,
            teacherId: teacher.id,
            name: config.name,
            status: 'active',
            createdAt: now,
            expiresAt,
            location: config.location,
            settings: {
                requireLocation: config.requireLocation ?? false,
                allowLateJoin: config.allowLateJoin ?? true,
                autoCloseAfter: config.duration
            }
        };

        this.rooms.set(room.id, room);
        this.attendance.set(room.id, []);
        this.roomConnections.set(room.id, new Set());

        // Auto-close room after duration
        setTimeout(() => this.closeRoom(room.id, teacher.id), config.duration * 60000);

        return room;
    }

    closeRoom(roomId: string, teacherId: string): void {
        const room = this.rooms.get(roomId);
        if (!room) throw new Error('Room not found');
        if (room.teacherId !== teacherId) throw new Error('Unauthorized');

        room.status = 'closed';

        // Notify all connected clients
        const connections = this.roomConnections.get(roomId);
        connections?.forEach(ws => {
            this.sendToClient(ws, { type: 'room_closed', roomId });
        });

        this.eventBus.emit('room:closed', { roomId, attendance: this.attendance.get(roomId) });
    }

    getAttendanceList(roomId: string, teacherId: string): AttendanceRecord[] {
        const room = this.rooms.get(roomId);
        if (!room) throw new Error('Room not found');
        if (room.teacherId !== teacherId) throw new Error('Unauthorized');

        return this.attendance.get(roomId) || [];
    }

    // ============================================
    // STUDENT FUNCTIONS
    // ============================================

    markAttendance(
        student: User,
        roomCode: string,
        location?: { latitude: number; longitude: number }
    ): AttendanceRecord {
        if (student.role !== 'student') {
            throw new Error('Only students can mark attendance');
        }

        // Find room by code
        const room = Array.from(this.rooms.values()).find(r => r.code === roomCode);
        if (!room) throw new Error('Invalid room code');
        if (room.status !== 'active') throw new Error('Room is closed');

        // Check if already marked
        const records = this.attendance.get(room.id) || [];
        if (records.some(r => r.studentId === student.id)) {
            throw new Error('Attendance already marked');
        }

        // Validate location if required
        if (room.settings.requireLocation) {
            if (!location || !room.location) {
                throw new Error('Location is required');
            }

            const distance = this.calculateDistance(
                location.latitude,
                location.longitude,
                room.location.latitude,
                room.location.longitude
            );

            if (distance > room.location.radius) {
                throw new Error('You are too far from the class location');
            }
        }

        // Check if late
        const now = new Date();
        const gracePeriod = 10 * 60000; // 10 minutes
        const isLate = now.getTime() > (room.createdAt.getTime() + gracePeriod);

        const record: AttendanceRecord = {
            id: crypto.randomUUID(),
            roomId: room.id,
            studentId: student.id,
            markedAt: now,
            location,
            status: isLate ? 'late' : 'present'
        };

        records.push(record);
        this.attendance.set(room.id, records);

        // Notify teacher
        this.notifyRoom(room.id, {
            type: 'student_joined',
            student: { id: student.id, name: student.name }
        });

        this.eventBus.emit('attendance:marked', record);

        return record;
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    private generateRoomCode(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        // Haversine formula
        const R = 6371e3; // Earth radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    private notifyRoom(roomId: string, message: WSResponse): void {
        const connections = this.roomConnections.get(roomId);
        connections?.forEach(ws => this.sendToClient(ws, message));
    }

    private sendToClient(ws: ServerWebSocket<WebSocketData>, message: WSResponse): void {
        ws.send(JSON.stringify(message));
    }

    addConnection(roomId: string, ws: ServerWebSocket<WebSocketData>): void {
        if (!this.roomConnections.has(roomId)) {
            this.roomConnections.set(roomId, new Set());
        }
        this.roomConnections.get(roomId)!.add(ws);
    }

    removeConnection(roomId: string, ws: ServerWebSocket<WebSocketData>): void {
        this.roomConnections.get(roomId)?.delete(ws);
    }

    private startCleanupTask(): void {
        setInterval(() => {
            const now = new Date();
            this.rooms.forEach((room, roomId) => {
                if (room.status === 'active' && now > room.expiresAt) {
                    this.closeRoom(roomId, room.teacherId);
                }
            });
        }, 60000); // Check every minute
    }

    getRoomByCode(code: string): Room | undefined {
        return Array.from(this.rooms.values()).find(r => r.code === code);
    }

    getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId);
    }
}

// ============================================
// WEBSOCKET SERVER SETUP
// ============================================

export function setupAttendanceWebSocket(
    eventBus: EventEmitter,
    getUserById: (id?: string) => Promise<User | null>
) {
    const manager = new AttendanceManager(eventBus);

    const wsServer = {
        websocket: {
            async message(ws: ServerWebSocket<WebSocketData>, message: string) {
                try {
                    const data: WSMessage = JSON.parse(message);
                    const user = await getUserById(ws.data.userId);

                    if (!user) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'User not found',
                            code: 'USER_NOT_FOUND'
                        }));
                        return;
                    }

                    switch (data.type) {
                        case 'join_room': {
                            const room = manager.getRoomByCode(data.roomCode);
                            if (!room) {
                                ws.send(JSON.stringify({
                                    type: 'error',
                                    message: 'Invalid room code',
                                    code: 'INVALID_ROOM_CODE'
                                }));
                                break;
                            }

                            ws.data.roomId = room.id;
                            manager.addConnection(room.id, ws);

                            if (user.role === 'student') {
                                try {
                                    //@ts-ignore
                                    const record = manager.markAttendance(user, data.roomCode, data.location);
                                    ws.send(JSON.stringify({
                                        type: 'attendance_marked',
                                        record
                                    }));
                                } catch (err) {
                                    ws.send(JSON.stringify({
                                        type: 'error',
                                        message: (err as Error).message,
                                        code: 'ATTENDANCE_ERROR'
                                    }));
                                }
                            } else {
                                const records = manager.getAttendanceList(room.id, user.id);
                                ws.send(JSON.stringify({
                                    type: 'room_joined',
                                    room,
                                    students: records
                                }));
                            }
                            break;
                        }

                        case 'mark_attendance': {
                            if (user.role !== 'student') {
                                ws.send(JSON.stringify({
                                    type: 'error',
                                    message: 'Only students can mark attendance',
                                    code: 'UNAUTHORIZED'
                                }));
                                break;
                            }

                            if (!ws.data.roomId) {
                                ws.send(JSON.stringify({
                                    type: 'error',
                                    message: 'Not in a room',
                                    code: 'NOT_IN_ROOM'
                                }));
                                break;
                            }

                            const room = manager.getRoom(ws.data.roomId);
                            if (!room) {
                                ws.send(JSON.stringify({
                                    type: 'error',
                                    message: 'Room not found',
                                    code: 'ROOM_NOT_FOUND'
                                }));
                                break;
                            }

                            try {
                                //@ts-ignore
                                const record = manager.markAttendance(user, room.code, data.location);
                                ws.send(JSON.stringify({
                                    type: 'attendance_marked',
                                    record
                                }));
                            } catch (err) {
                                ws.send(JSON.stringify({
                                    type: 'error',
                                    message: (err as Error).message,
                                    code: 'ATTENDANCE_ERROR'
                                }));
                            }
                            break;
                        }

                        case 'close_room': {
                            if (user.role !== 'teacher') {
                                ws.send(JSON.stringify({
                                    type: 'error',
                                    message: 'Only teachers can close rooms',
                                    code: 'UNAUTHORIZED'
                                }));
                                break;
                            }

                            if (!ws.data.roomId) {
                                ws.send(JSON.stringify({
                                    type: 'error',
                                    message: 'Not in a room',
                                    code: 'NOT_IN_ROOM'
                                }));
                                break;
                            }

                            manager.closeRoom(ws.data.roomId, user.id);
                            break;
                        }

                        case 'get_attendance_list': {
                            if (user.role !== 'teacher' || !ws.data.roomId) {
                                ws.send(JSON.stringify({
                                    type: 'error',
                                    message: 'Unauthorized',
                                    code: 'UNAUTHORIZED'
                                }));
                                break;
                            }

                            const records = manager.getAttendanceList(ws.data.roomId, user.id);
                            ws.send(JSON.stringify({
                                type: 'attendance_list',
                                records
                            }));
                            break;
                        }

                        case 'ping': {
                            ws.send(JSON.stringify({ type: 'pong' }));
                            break;
                        }
                    }
                } catch (err) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Invalid message format',
                        code: 'INVALID_MESSAGE'
                    }));
                }
            },

            open(ws: ServerWebSocket<WebSocketData>) {
                console.log(`User ${ws.data.userId} connected`);
            },

            close(ws: ServerWebSocket<WebSocketData>) {
                if (ws.data.roomId) {
                    manager.removeConnection(ws.data.roomId, ws);
                }
                console.log(`User ${ws.data.userId} disconnected`);
            }
        }
    }
    // console.log(`WebSocket server running on ws://localhost:${wsServer.port}`);

    return { server: wsServer, manager };
}