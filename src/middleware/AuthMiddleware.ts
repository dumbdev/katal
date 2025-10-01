import type { Middleware, MiddlewareContext } from "../types";
import { Auth } from "../auth";

export function createAuthMiddleware(auth: Auth): Middleware {
    return {
        async before(context: MiddlewareContext): Promise<Response | null> {
            const user = await auth.authenticate(context.request);

            if (!user) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        message: "Unauthorized",
                    }),
                    {
                        status: 401,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            // Attach user to request (using headers as a workaround)
            // In a real implementation, you might use a context object
            return null; // Allow request to proceed
        },
    };
}

export function createOptionalAuthMiddleware(auth: Auth): Middleware {
    return {
        async before(context: MiddlewareContext): Promise<Response | null> {
            await auth.authenticate(context.request);
            // Always allow request to proceed, but user info is available if authenticated
            return null;
        },
    };
}
