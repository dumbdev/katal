import {
    Application,
    Controller,
    Auth,
    createAuthMiddleware,
    createCorsMiddleware,
    createRateLimitMiddleware,
} from "../../src/index.ts";
import type { RequestContext } from "../../src/index.ts";

const app = new Application({ port: 3000 });
const router = app.getRouter();

// Setup authentication
const auth = new Auth({
    secret: "your-secret-key-change-in-production",
    expiresIn: "24h",
});

app.singleton("auth", () => auth);

const middlewareManager = (app as any).middlewareManager;
middlewareManager.register("auth", createAuthMiddleware(auth));

// Add global middleware
app.use(createCorsMiddleware({ origin: "*", credentials: true }));
app.use(createRateLimitMiddleware({ windowMs: 60000, maxRequests: 100 }));

// ============================================================================
// CONTROLLERS - Each controller handles ONE route
// ============================================================================

// Health check
class HealthController extends Controller {
    async handle() {
        return this.success({
            status: "ok",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        });
    }
}

// Get all users
class GetUsersController extends Controller {
    async handle() {
        return this.success([
            { id: 1, name: "John Doe", email: "john@example.com" },
            { id: 2, name: "Jane Smith", email: "jane@example.com" },
        ]);
    }
}

// Get single user
class GetUserController extends Controller {
    async handle(context: RequestContext) {
        const { id } = context.params;
        return this.success({
            id,
            name: "John Doe",
            email: "john@example.com",
        });
    }
}

// Create user
class CreateUserController extends Controller {
    async handle(context: RequestContext) {
        const { name, email, age } = context.body;
        return this.success(
            {
                id: Math.random().toString(36).substr(2, 9),
                name,
                email,
                age,
                createdAt: new Date().toISOString(),
            },
            "User created successfully",
        );
    }
}

// Update user
class UpdateUserController extends Controller {
    async handle(context: RequestContext) {
        const { id } = context.params;
        return this.success(
            {
                id,
                ...context.body,
                updatedAt: new Date().toISOString(),
            },
            "User updated successfully",
        );
    }
}

// Delete user
class DeleteUserController extends Controller {
    async handle(context: RequestContext) {
        const { id } = context.params;
        return this.success(null, `User ${id} deleted successfully`);
    }
}

// Register
class RegisterController extends Controller {
    async handle(context: RequestContext) {
        const { email, password, name } = context.body;
        const auth = app.resolve<Auth>("auth");

        const hashedPassword = await auth.hashPassword(password);

        const user = {
            id: Math.random().toString(36).substr(2, 9),
            email,
            name,
            password: hashedPassword,
        };

        const token = await auth.generateToken(user);

        return this.success({
            user: { id: user.id, email: user.email, name: user.name },
            token,
        });
    }
}

// Login
class LoginController extends Controller {
    async handle(context: RequestContext) {
        const { email, password } = context.body;
        const auth = app.resolve<Auth>("auth");

        // In real app, fetch user from database
        const user = {
            id: "123",
            email: "demo@example.com",
            name: "Demo User",
            password: await auth.hashPassword("password123"),
        };

        const isValid = await auth.verifyPassword(password, user.password);

        if (!isValid) {
            return this.error("Invalid credentials", 401);
        }

        const token = await auth.generateToken(user);

        return this.success({
            user: { id: user.id, email: user.email, name: user.name },
            token,
        });
    }
}

// Protected profile
class ProfileController extends Controller {
    async handle() {
        return this.success({
            message: "This is a protected route",
            user: { id: "123", name: "Demo User" },
        });
    }
}

// Dashboard
class DashboardController extends Controller {
    async handle() {
        return this.success({
            stats: {
                totalUsers: 1000,
                activeUsers: 250,
                revenue: 50000,
            },
        });
    }
}

// ============================================================================
// ROUTE REGISTRATION - Register routes outside controllers
// ============================================================================

// Health
router.get("/health", HealthController);

// Users
router.get("/users", GetUsersController);
router.get("/users/:id", GetUserController);
router.post("/users", CreateUserController, {
    validation: {
        name: {
            required: true,
            type: "string",
            minLength: 2,
            maxLength: 50,
        },
        email: {
            required: true,
            type: "email",
        },
        age: {
            type: "number",
            min: 18,
            max: 120,
        },
    },
});
router.put("/users/:id", UpdateUserController, {
    validation: {
        name: { type: "string", minLength: 2 },
        email: { type: "email" },
    },
});
router.delete("/users/:id", DeleteUserController);

// Auth
router.post("/auth/register", RegisterController, {
    validation: {
        email: { required: true, type: "email" },
        password: { required: true, type: "string", minLength: 6 },
        name: { required: true, type: "string" },
    },
});
router.post("/auth/login", LoginController, {
    validation: {
        email: { required: true, type: "email" },
        password: { required: true, type: "string" },
    },
});

// Protected routes
router.get("/protected/profile", ProfileController, {
    middleware: ["auth"],
});
router.get("/protected/dashboard", DashboardController, {
    middleware: ["auth"],
});

// Start server
app.listen();

console.log("\n📚 Available routes:");
console.log("  GET    /health");
console.log("  GET    /users");
console.log("  GET    /users/:id");
console.log("  POST   /users");
console.log("  PUT    /users/:id");
console.log("  DELETE /users/:id");
console.log("  POST   /auth/register");
console.log("  POST   /auth/login");
console.log("  GET    /protected/profile (requires auth)");
console.log("  GET    /protected/dashboard (requires auth)");
console.log("\n💡 Try:");
console.log("  curl http://localhost:3000/health");
console.log("  curl http://localhost:3000/users");
console.log(
    '  curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d \'{"name":"John","email":"john@test.com","age":25}\'',
);
