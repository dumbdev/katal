import type { Middleware, MiddlewareContext } from "../types";

export interface CorsOptions {
    origin?: string | string[];
    methods?: string[];
    allowedHeaders?: string[];
    exposedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
}

export function createCorsMiddleware(options: CorsOptions = {}): Middleware {
    const {
        origin = "*",
        methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders = ["Content-Type", "Authorization"],
        exposedHeaders = [],
        credentials = false,
        maxAge = 86400,
    } = options;

    return {
        async before(context: MiddlewareContext): Promise<Response | null> {
            const requestOrigin = context.request.headers.get("Origin");

            // Handle preflight requests
            if (context.request.method === "OPTIONS") {
                const headers = new Headers();

                // Set origin
                if (Array.isArray(origin)) {
                    if (requestOrigin && origin.includes(requestOrigin)) {
                        headers.set(
                            "Access-Control-Allow-Origin",
                            requestOrigin,
                        );
                    }
                } else {
                    headers.set("Access-Control-Allow-Origin", origin);
                }

                headers.set("Access-Control-Allow-Methods", methods.join(", "));
                headers.set(
                    "Access-Control-Allow-Headers",
                    allowedHeaders.join(", "),
                );

                if (exposedHeaders.length > 0) {
                    headers.set(
                        "Access-Control-Expose-Headers",
                        exposedHeaders.join(", "),
                    );
                }

                if (credentials) {
                    headers.set("Access-Control-Allow-Credentials", "true");
                }

                headers.set("Access-Control-Max-Age", maxAge.toString());

                return new Response(null, { status: 204, headers });
            }

            return null;
        },

        async after(context: MiddlewareContext): Promise<Response> {
            const requestOrigin = context.request.headers.get("Origin");
            const response = context.response!;

            // Add CORS headers to the response
            const headers = new Headers(response.headers);

            if (Array.isArray(origin)) {
                if (requestOrigin && origin.includes(requestOrigin)) {
                    headers.set("Access-Control-Allow-Origin", requestOrigin);
                }
            } else {
                headers.set("Access-Control-Allow-Origin", origin);
            }

            if (exposedHeaders.length > 0) {
                headers.set(
                    "Access-Control-Expose-Headers",
                    exposedHeaders.join(", "),
                );
            }

            if (credentials) {
                headers.set("Access-Control-Allow-Credentials", "true");
            }

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers,
            });
        },
    };
}
