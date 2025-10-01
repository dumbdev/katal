import type { Middleware, MiddlewareContext } from "../types";

interface RateLimitOptions {
    windowMs: number; // Time window in milliseconds
    maxRequests: number; // Max requests per window
}

interface RateLimitRecord {
    count: number;
    resetTime: number;
}

export function createRateLimitMiddleware(
    options: RateLimitOptions,
): Middleware {
    const { windowMs, maxRequests } = options;
    const clients = new Map<string, RateLimitRecord>();

    return {
        async before(context: MiddlewareContext): Promise<Response | null> {
            const clientId = getClientId(context.request);
            const now = Date.now();

            let record = clients.get(clientId);

            // Reset if window has passed
            if (!record || now > record.resetTime) {
                record = {
                    count: 0,
                    resetTime: now + windowMs,
                };
                clients.set(clientId, record);
            }

            record.count++;

            if (record.count > maxRequests) {
                const retryAfter = Math.ceil((record.resetTime - now) / 1000);

                return new Response(
                    JSON.stringify({
                        success: false,
                        message: "Too many requests",
                        retryAfter,
                    }),
                    {
                        status: 429,
                        headers: {
                            "Content-Type": "application/json",
                            "Retry-After": retryAfter.toString(),
                            "X-RateLimit-Limit": maxRequests.toString(),
                            "X-RateLimit-Remaining": "0",
                            "X-RateLimit-Reset": record.resetTime.toString(),
                        },
                    },
                );
            }

            return null;
        },

        async after(context: MiddlewareContext): Promise<Response> {
            const clientId = getClientId(context.request);
            const record = clients.get(clientId);
            const response = context.response!;

            if (record) {
                // Add rate limit headers to response
                const headers = new Headers(response.headers);
                headers.set("X-RateLimit-Limit", maxRequests.toString());
                headers.set(
                    "X-RateLimit-Remaining",
                    Math.max(0, maxRequests - record.count).toString(),
                );
                headers.set("X-RateLimit-Reset", record.resetTime.toString());

                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers,
                });
            }

            return response;
        },
    };
}

function getClientId(request: Request): string {
    // Try to get IP from various headers
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0]?.trim() ?? "unknown";
    }

    const realIp = request.headers.get("x-real-ip");
    if (realIp) {
        return realIp;
    }

    // Fallback to URL (not ideal but works for development)
    return new URL(request.url).hostname;
}
