import { db } from "..";
import { roomsTable } from "../db/schema/room";

export async function createRoom(data: {
    name: string;
    capacity: number;
}) {
    const [room] = await db
        .insert(roomsTable)
        .values(data)
        .returning();

    return room;
}