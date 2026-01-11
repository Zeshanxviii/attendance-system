import { db } from "../../index";
import { usersTable } from "../../db/schema/users";
import { eq } from "drizzle-orm";
import * as bcrypt from "bcrypt";
import jwt from "jsonwebtoken"

export const signUpHandler = async (req: Request) => {
  try {
    const body = await req.json();
    const { name, email, password, age, role } = body as {
      name: string;
      email: string;
      password: string;
      age: number;
      role: 'student' | 'teacher';
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
      role,
    });

    return new Response(JSON.stringify({ message: "User created successfully" }), { status: 201 });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ message: "Internal server error" }), { status: 500 });
  }
};

type RouteHandler = (req: Request) => Response | Promise<Response>

export const loginHandler: RouteHandler = async (req: Request) => {
  try {
    const body = await req.json()
    const { email, password } = body as {
      email: string
      password: string
    }

    if (!email || !password) return new Response(JSON.stringify({ message: "email and Password required !" }), { status: 401 })

    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1)

    const user = users[0]
    const isPasswordValid = await bcrypt.compare(password, user?.password ?? "")

    const accessToken = jwt.sign(
      { id: user?.id, email: user?.email },
      process.env.PRIVATE_KEY!,
      { algorithm: "RS256", expiresIn: "1h" }
    );

    const refreshToken = jwt.sign(
      { id: user?.id },
      process.env.PRIVATE_KEY!,
      { algorithm: "RS256", expiresIn: "7d" }
    );


    if (!isPasswordValid) {
      return Response.json(
        { message: "Invalid email or password" },
        { status: 401 }
      )
    }

    return Response.json(
      { message: "Login successful", accessToken, refreshToken },
      { status: 200 }
    )

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ message: "Internal server error" }), { status: 500 });
  }
}
