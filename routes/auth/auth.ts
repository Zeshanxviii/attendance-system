import { db } from "../../index";
import { usersTable } from "../../db/schema/users";
import { eq } from "drizzle-orm";
import * as bcrypt from "bcrypt";

export const signUpHandler = async (req: Request) => {
  try {
    const body = await req.json();
    const { name, email, password, age } = body as {
      name: string;
      email: string;
      password: string;
      age: number;
    };

    if (!name || !email || !password || !age) {
      return new Response(JSON.stringify({ message: "All fields are required" }), { status: 400 });
    }

    const existingUser = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return new Response(JSON.stringify({ message: "User already exists" }), { status: 409 });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.insert(usersTable).values({
      name,
      email,
      password: hashedPassword,
      age,
    });

    return new Response(JSON.stringify({ message: "User created successfully" }), { status: 201 });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ message: "Internal server error" }), { status: 500 });
  }
};


const loginHandler = () => {
  try {

  } catch (error) {

  }
}

export default loginHandler;

// export const signUpHandler = async (req: Request) => {
//     try {
//         const body = await req.json();
//         const { name, email, password, age } = body;

//         if (!name || !email || !password || !age) {
//             return new Response(
//                 JSON.stringify({ message: "All fields are required" }),
//                 { status: 400 }
//             );
//         }

//         // Check if user already exists
//         const existingUser = await db
//             .select()
//             .from(usersTable)
//             .where(eq(usersTable.email, email))
//             .limit(1);

//         if (existingUser.length > 0) {
//             return new Response(
//                 JSON.stringify({ message: "User already exists" }),
//                 { status: 409 }
//             );
//         }

//         // ⚠️ NEVER store plain passwords (use hash later)
//         await db.insert(usersTable).values({
//             name,
//             email,
//             password, // hash this later
//             age,
//         });

//         return new Response(
//             JSON.stringify({ message: "User created successfully" }),
//             { status: 201 }
//         );
//     } catch (error) {
//         console.error(error);
//         return new Response(
//             JSON.stringify({ message: "Internal server error" }),
//             { status: 500 }
//         );
//     }
// };
