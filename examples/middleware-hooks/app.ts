import { Application, Controller } from "../../src/index.ts";
import type {
    RequestContext,
    Middleware,
    MiddlewareContext,
} from "../../src/index.ts";
// Add DOM lib to tsconfig.json to include types like BodyInit

const app = new Application({ port: 3000 });
const router = app.getRouter();
const middlewareManager = (app as any).middlewareManager;

// ============================================================================
// CUSTOM MIDDLEWARE WITH BEFORE AND AFTER HOOKS
// ============================================================================

/**
 * Logging Middleware - Logs before and after request
 */
const loggingMiddleware: Middleware = {
    async before(context: MiddlewareContext) {
        const url = new URL(context.request.url);
        console.log(
            `📝 [${new Date().toISOString()}] ${context.request.method} ${url.pathname}`,
        );
        return null; // Continue
    },

    async after(context: MiddlewareContext) {
        const response = context.response!;
        console.log(`✅ Response: ${response.status}`);
        return response;
    },
};

/**
 * Timing Middleware - Measures request duration
 */
const timingMiddleware: Middleware = {
    async before(context: MiddlewareContext) {
        // Store start time in a header (in real app, use a proper context store)
        const startTime = Date.now();
        (context.request as any)._startTime = startTime;
        return null;
    },

    async after(context: MiddlewareContext) {
        const startTime = (context.request as any)._startTime;
        const duration = Date.now() - startTime;
        const response = context.response!;

        // Add timing header to response
        const headers = new Headers(response.headers);
        headers.set("X-Response-Time", `${duration}ms`);

        console.log(`⏱️  Request took ${duration}ms`);

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    },
};

/**
 * Request ID Middleware - Adds unique ID to each request
 */
const requestIdMiddleware: Middleware = {
    async before(context: MiddlewareContext) {
        const requestId = Math.random().toString(36).substr(2, 9);
        (context.request as any)._requestId = requestId;
        console.log(`🔖 Request ID: ${requestId}`);
        return null;
    },

    async after(context: MiddlewareContext) {
        const requestId = (context.request as any)._requestId;
        const response = context.response!;

        // Add request ID to response headers
        const headers = new Headers(response.headers);
        headers.set("X-Request-ID", requestId);

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    },
};

/**
 * Response Wrapper Middleware - Wraps all JSON responses
 */
const responseWrapperMiddleware: Middleware = {
    async after(context: MiddlewareContext) {
        const response = context.response!;

        // Only wrap JSON responses
        const contentType = response.headers.get("Content-Type");
        if (!contentType?.includes("application/json")) {
            return response;
        }

        try {
            const data = await response.json();

            // Wrap the response
            const wrapped = {
                success: response.status < 400,
                timestamp: new Date().toISOString(),
                data,
            };

            return new Response(JSON.stringify(wrapped), {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
            });
        } catch {
            // If not JSON, return as-is
            return response;
        }
    },
};

/**
 * Security Headers Middleware - Adds security headers
 */
const securityHeadersMiddleware: Middleware = {
    async after(context: MiddlewareContext) {
        const response = context.response!;
        const headers = new Headers(response.headers);

        // Add security headers
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("X-Frame-Options", "DENY");
        headers.set("X-XSS-Protection", "1; mode=block");
        headers.set(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains",
        );

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    },
};

/**
 * Compression Info Middleware - Adds info about response size
 */
const compressionInfoMiddleware: Middleware = {
    async after(context: MiddlewareContext) {
        const response = context.response!;

        // Calculate response size
        const blob = await response.blob();
        const size = blob.size;

        const headers = new Headers(response.headers);
        headers.set("X-Response-Size", `${size} bytes`);

        console.log(`📦 Response size: ${size} bytes`);

        // Use the blob as the response body
        return new Response(blob as any, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    },
};

// ============================================================================
// REGISTER MIDDLEWARE
// ============================================================================

// Global middleware - runs on all requests
app.use(loggingMiddleware);
app.use(timingMiddleware);
app.use(requestIdMiddleware);

// Named middleware - can be applied to specific routes
middlewareManager.register("wrapper", responseWrapperMiddleware);
middlewareManager.register("security", securityHeadersMiddleware);
middlewareManager.register("compression-info", compressionInfoMiddleware);

// ============================================================================
// CONTROLLERS
// ============================================================================

class HomeController extends Controller {
    async handle() {
        return this.success({
            message: "Welcome to Middleware Hooks Demo",
            features: [
                "Logging (before & after)",
                "Timing (before & after)",
                "Request ID (before & after)",
            ],
        });
    }
}

class UsersController extends Controller {
    async handle() {
        // Simulate some processing time
        await new Promise((resolve) => setTimeout(resolve, 100));

        return this.success([
            { id: 1, name: "John Doe" },
            { id: 2, name: "Jane Smith" },
        ]);
    }
}

class SlowController extends Controller {
    async handle() {
        // Simulate slow operation
        await new Promise((resolve) => setTimeout(resolve, 2000));

        return this.success({
            message: "This was a slow operation",
            duration: "2 seconds",
        });
    }
}

class SecureController extends Controller {
    async handle() {
        return this.success({
            message: "This response has security headers",
            secure: true,
        });
    }
}

// ============================================================================
// ROUTE REGISTRATION
// ============================================================================

// Basic routes (only global middleware)
router.get("/", HomeController);

// Route with response wrapper middleware
router.get("/users", UsersController, {
    middleware: ["wrapper"],
});

// Route with multiple middleware
router.get("/slow", SlowController, {
    middleware: ["wrapper", "compression-info"],
});

// Route with security headers
router.get("/secure", SecureController, {
    middleware: ["security", "wrapper"],
});

// Start server
app.listen();

console.log("\n📚 Middleware Demo");
console.log("\n  Global Middleware (all routes):");
console.log("    - Logging (before & after)");
console.log("    - Timing (before & after)");
console.log("    - Request ID (before & after)");
console.log("\n  Available routes:");
console.log("    GET  /          - Basic route");
console.log("    GET  /users     - With response wrapper");
console.log("    GET  /slow      - With wrapper + compression info");
console.log("    GET  /secure    - With security headers + wrapper");
console.log("\n💡 Try:");
console.log("  curl -i http://localhost:3000/");
console.log("  curl -i http://localhost:3000/users");
console.log("  curl -i http://localhost:3000/secure");
console.log("\n  Notice the headers:");
console.log("    - X-Response-Time");
console.log("    - X-Request-ID");
console.log("    - X-Response-Size");
console.log("    - Security headers on /secure");
