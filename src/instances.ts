import { EventEmitter } from "events";
import { AttendanceManager } from "./modules/attendance/attendance.manager";

export const eventBus = new EventEmitter();
eventBus.setMaxListeners(50);

export const attendanceManager = new AttendanceManager(eventBus);
