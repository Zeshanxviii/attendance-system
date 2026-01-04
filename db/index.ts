// import { SQL } from "bun";

// const pg = new SQL("postgres://admin:password123@localhost:5432/attendance_system");

// // 2. Connection Health Check Function
// export async function checkDatabase() {
//     try {
//         // This forces Bun to actually open a connection
//         await pg`SELECT 1`;
//         console.log("Database connection established successfully.");
//     } catch (error) {
//         console.error("Database connection failed:");
//         console.error(error);
//         process.exit(1); // Optional: Stop the server if DB is down
//     }
// }
// export default pg;