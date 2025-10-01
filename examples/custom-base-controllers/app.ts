import { Application, Controller } from "../../src";

const app = new Application({ port: 3000 });
const router = app.getRouter();

// ============================================================================
// CUSTOM BASE CONTROLLERS - Extend Controller for specialized behavior
// ============================================================================

/**
 * AdminController - Base controller for admin routes
 * Adds automatic admin authentication check
 */
abstract class AdminController extends Controller {
    protected override async beforeHandle(): Promise<Response | null> {
        // Check if user is admin (simplified example)
        const authHeader = this.context.request.headers.get("Authorization");

        if (!authHeader || !authHeader.includes("admin-token")) {
            return this.error("Admin access required", 403);
        }

        // You could also set admin user data here
        console.log("✅ Admin authenticated");
        return null; // Continue to handle()
    }

    // Admin controllers can use this helper
    protected getAdminUser() {
        return {
            id: "admin-1",
            name: "Admin User",
            role: "admin",
        };
    }
}

/**
 * ApiController - Base controller for API routes
 * Adds automatic API versioning and response formatting
 */
abstract class ApiController extends Controller {
    protected apiVersion = "v1";

    protected override async afterHandle(response: any): Promise<any> {
        // Wrap all responses with API metadata
        if (response instanceof Response) {
            return response;
        }

        return this.json({
            version: this.apiVersion,
            timestamp: new Date().toISOString(),
            data: response,
        });
    }
}

/**
 * AuthenticatedController - Base controller requiring authentication
 * Checks for valid user token
 */
abstract class AuthenticatedController extends Controller {
    protected user: any;

    protected override async beforeHandle(): Promise<Response | null> {
        const authHeader = this.context.request.headers.get("Authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return this.error("Authentication required", 401);
        }

        // Simplified: In real app, verify JWT token
        this.user = {
            id: "user-123",
            name: "John Doe",
            email: "john@example.com",
        };

        console.log(`✅ User authenticated: ${this.user.name}`);
        return null;
    }

    // Authenticated controllers can access user
    protected getCurrentUser() {
        return this.user;
    }
}

/**
 * LoggingController - Base controller that logs all requests
 */
abstract class LoggingController extends Controller {
    protected override async beforeHandle(): Promise<Response | null> {
        console.log(
            `📝 [${new Date().toISOString()}] ${this.context.request.method} ${new URL(this.context.request.url).pathname}`,
        );
        return null;
    }

    protected override async afterHandle(response: any): Promise<any> {
        console.log(`✅ Request completed successfully`);
        return response;
    }
}

/**
 * CachedController - Base controller with simple caching
 */
abstract class CachedController extends Controller {
    private static cache = new Map<string, { data: any; timestamp: number }>();
    protected cacheDuration = 60000; // 1 minute

    protected getCacheKey(): string {
        return new URL(this.context.request.url).pathname;
    }

    protected override async beforeHandle(): Promise<Response | null> {
        const key = this.getCacheKey();
        const cached = CachedController.cache.get(key);

        if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
            console.log(`💾 Cache hit for ${key}`);
            return this.success(cached.data);
        }

        return null;
    }

    protected override async afterHandle(response: any): Promise<any> {
        // Cache successful responses
        if (response instanceof Response && response.status === 200) {
            const key = this.getCacheKey();
            const data = (await response.clone().json()) as { data: any };
            CachedController.cache.set(key, {
                data: data.data,
                timestamp: Date.now(),
            });
            console.log(`💾 Cached response for ${key}`);
        }

        return response;
    }
}

// ============================================================================
// CONTROLLERS USING CUSTOM BASE CLASSES
// ============================================================================

// Admin Dashboard - uses AdminController
class AdminDashboardController extends AdminController {
    async handle() {
        const admin = this.getAdminUser();

        return this.success({
            message: "Admin Dashboard",
            admin,
            stats: {
                totalUsers: 1000,
                revenue: 50000,
            },
        });
    }
}

// Admin Users - uses AdminController
class AdminUsersController extends AdminController {
    async handle() {
        return this.success({
            users: [
                { id: 1, name: "John Doe", role: "user" },
                { id: 2, name: "Jane Smith", role: "user" },
            ],
        });
    }
}

// API Stats - uses ApiController
class ApiStatsController extends ApiController {
    async handle() {
        // Return plain data - afterHandle will wrap it
        return {
            requests: 1000,
            users: 250,
            uptime: process.uptime(),
        };
    }
}

// User Profile - uses AuthenticatedController
class UserProfileController extends AuthenticatedController {
    async handle() {
        const user = this.getCurrentUser();

        return this.success({
            profile: user,
            settings: {
                theme: "dark",
                notifications: true,
            },
        });
    }
}

// Update Profile - uses AuthenticatedController
class UpdateProfileController extends AuthenticatedController {
    async handle() {
        const user = this.getCurrentUser();
        const updates = this.context.body;

        return this.success(
            {
                ...user,
                ...updates,
                updatedAt: new Date().toISOString(),
            },
            "Profile updated",
        );
    }
}

// Products List - uses CachedController
class ProductsController extends CachedController {
    async handle() {
        // Simulate slow database query
        console.log("🔍 Fetching products from database...");

        return this.success([
            { id: 1, name: "Product A", price: 100 },
            { id: 2, name: "Product B", price: 200 },
            { id: 3, name: "Product C", price: 300 },
        ]);
    }
}

// Health Check - uses LoggingController
class HealthController extends LoggingController {
    async handle() {
        return this.success({
            status: "ok",
            timestamp: new Date().toISOString(),
        });
    }
}

// Regular controller - no special base class
class HomeController extends Controller {
    async handle() {
        return this.success({
            message: "Welcome to Katal Framework",
            version: "0.3.0",
        });
    }
}

// Controller demonstrating LoggingIntegration
class LoggingDemoController extends Controller {
    async handle() {
        // Create logger with console destination
        const logger = this.LoggingIntegration().toConsole();

        // Log different levels
        await logger.debug("Debug message", { userId: 123 });
        await logger.info("User accessed logging demo", {
            ip:
                this.context.request.headers.get("x-forwarded-for") ||
                "unknown",
            userAgent: this.context.request.headers.get("user-agent"),
        });
        await logger.warn("This is a warning message");

        return this.success({
            message: "Logging demo - check console for logs",
            logLevels: ["debug", "info", "warn", "error"],
        });
    }
}

// Controller with file logging
class FileLoggingController extends Controller {
    async handle() {
        // Create logger with both console and file destinations
        const logger = this.LoggingIntegration()
            .toConsole()
            .toFile("./logs/app.log");

        await logger.info("Request logged to file", {
            path: new URL(this.context.request.url).pathname,
            method: this.context.request.method,
        });

        return this.success({
            message: "Logged to both console and file",
            logFile: "./logs/app.log",
        });
    }
}

// Controller with custom log destination (database example)
import { LogLevel } from "../../src/index.ts";
import type { LogDestination, LogEntry } from "../../src/index.ts";

class DatabaseDestination implements LogDestination {
    async write(entry: LogEntry): Promise<void> {
        // Simulate database insert
        console.log(`📊 [DB] Saving log to database:`, {
            level: entry.level,
            message: entry.message,
            timestamp: entry.timestamp,
        });
        // In real app: await db.logs.insert(entry);
    }
}

class CustomLoggingController extends Controller {
    async handle() {
        // Create logger with custom destination
        const logger = this.LoggingIntegration()
            .toConsole()
            .addDestination(new DatabaseDestination())
            .setMinLevel(LogLevel.INFO); // Only log INFO and above

        await logger.debug("This won't be logged (below min level)");
        await logger.info("This will be logged to console and database");

        try {
            throw new Error("Simulated error");
        } catch (error) {
            await logger.error("An error occurred", error as Error, {
                controller: "CustomLoggingController",
            });
        }

        return this.success({
            message: "Custom logging with multiple destinations",
            destinations: ["console", "database"],
        });
    }
}

// ============================================================================
// ROUTE REGISTRATION
// ============================================================================

// Public routes
router.get("/", HomeController);
router.get("/health", HealthController);

// Admin routes (require admin token)
router.get("/admin/dashboard", AdminDashboardController);
router.get("/admin/users", AdminUsersController);

// API routes (auto-wrapped with metadata)
router.get("/api/stats", ApiStatsController);

// Authenticated routes (require user token)
router.get("/profile", UserProfileController);
router.put("/profile", UpdateProfileController, {
    validation: {
        name: { type: "string" },
        email: { type: "email" },
    },
});

// Cached routes
router.get("/products", ProductsController);

// Logging demo routes
router.get("/logging/demo", LoggingDemoController);
router.get("/logging/file", FileLoggingController);
router.get("/logging/custom", CustomLoggingController);

// Start server
app.listen();

console.log("\n📚 Available routes:");
console.log("\n  Public:");
console.log("    GET  /");
console.log("    GET  /health");
console.log("\n  Admin (requires admin-token):");
console.log("    GET  /admin/dashboard");
console.log("    GET  /admin/users");
console.log("\n  API (auto-wrapped):");
console.log("    GET  /api/stats");
console.log("\n  Authenticated (requires Bearer token):");
console.log("    GET  /profile");
console.log("    PUT  /profile");
console.log("\n  Cached:");
console.log("    GET  /products");
console.log("\n  Logging Demos:");
console.log("    GET  /logging/demo");
console.log("    GET  /logging/file");
console.log("    GET  /logging/custom");

console.log("\n💡 Try:");
console.log("  # Public route");
console.log("  curl http://localhost:3000/");
console.log("\n  # Admin route (will fail without token)");
console.log("  curl http://localhost:3000/admin/dashboard");
console.log("\n  # Admin route (with token)");
console.log(
    '  curl http://localhost:3000/admin/dashboard -H "Authorization: admin-token"',
);
console.log("\n  # Authenticated route");
console.log(
    '  curl http://localhost:3000/profile -H "Authorization: Bearer user-token"',
);
console.log("\n  # Cached route (try multiple times)");
console.log("  curl http://localhost:3000/products");
console.log("\n  # Logging demos");
console.log("  curl http://localhost:3000/logging/demo");
console.log("  curl http://localhost:3000/logging/file");
console.log("  curl http://localhost:3000/logging/custom");
