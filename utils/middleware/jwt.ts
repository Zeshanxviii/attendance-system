import jwt from "jsonwebtoken"

export type JWTRequest = Request & { user?: any }

export const jwtMiddleware = (handler: (req: JWTRequest) => Promise<Response>) => {
    return async (req: JWTRequest) => {
        const authHeader = req.headers.get("Authorization")
        if (!authHeader?.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ message: "Missing token" }), { status: 401 })
        }

        const token = authHeader.split(" ")[1]
        try {
            const payload = jwt.verify(token ?? "", process.env.PUBLIC_KEY!, { algorithms: ["RS256"] })
            req.user = payload
            return await handler(req)
        } catch (err) {
            return new Response(JSON.stringify({ message: "Invalid token" }), { status: 401 })
        }
    }
}
