# Contro

A Laravel-inspired web framework for Bun with TypeScript. Build modern web applications with decorators, controllers, middleware, validation, and authentication.

## Features

- 🎯 **Simple routing** - One controller per route
- ✅ **Built-in validation** - Automatic validation before handlers
- 🔐 **JWT authentication** - Out of the box
- 🛡️ **Middleware system** - Global and route-specific
- 📦 **Dependency injection** - Built-in container
- 🚦 **Rate limiting** - Built-in middleware
- 🌐 **CORS** - Built-in support
- 🔧 **Extensible** - Create custom base controllers
- ⚡ **Built for Bun** - Leveraging Bun's native performance

## Installation

```bash
bun install
```

## Quick Start

```typescript
import { Application, Controller } from "contro";
import type { RequestContext } from "contro";

const app = new Application({ port: 3000 });
const router = app.getRouter();

// Define controllers - each handles ONE route
class GetUsersController extends Controller {
    async handle() {
        return this.success([
            { id: 1, name: "John Doe" },
            { id: 2, name: "Jane Smith" },
        ]);
    }
}

class CreateUserController extends Controller {
    async handle(context: RequestContext) {
        return this.success(context.body, "User created");
    }
}

// Register routes - outside controllers
router.get("/users", GetUsersController);
router.post("/users", CreateUserController, {
    validation: {
        name: { required: true, type: "string", minLength: 2 },
        email: { required: true, type: "email" },
    },
});

// Start server
app.listen();
```

## Documentation

### Controllers

Each controller handles **one route** and implements a `handle()` method:

```typescript
class GetPostsController extends Controller {
    async handle(context: RequestContext) {
        return this.success(posts);
    }
}

class GetPostController extends Controller {
    async handle(context: RequestContext) {
        const { id } = context.params;
        return this.success(posts.find((p) => p.id === id));
    }
}

class CreatePostController extends Controller {
    async handle(context: RequestContext) {
        return this.success(context.body, "Post created");
    }
}
```

#### Custom Base Controllers

Extend `Controller` to create specialized base controllers:

```typescript
// Admin controller with automatic auth check
abstract class AdminController extends Controller {
  protected async beforeHandle(): Promise<Response | null> {
    if (!this.isAdmin()) {
      return this.error("Admin access required", 403);
    }
    return null;
  }
}

// Use it
class AdminDashboardController extends AdminController {
  async handle() {
    return this.success({ stats: {...} });
  }
}
```

**Lifecycle Hooks:**

- `beforeHandle()` - Called before `handle()`, return Response to short-circuit
- `afterHandle(response)` - Called after `handle()`, modify response
- `context` - Access request context in any method

### Route Registration

Routes are registered **outside** controllers using the router:

```typescript
const router = app.getRouter();

// Simple routes
router.get("/posts", GetPostsController);
router.get("/posts/:id", GetPostController);

// With validation
router.post("/posts", CreatePostController, {
    validation: {
        title: { required: true, type: "string" },
        content: { required: true, type: "string" },
    },
});

// With middleware
router.get("/admin", AdminController, {
    middleware: ["auth", "admin"],
});

// With both
router.put("/posts/:id", UpdatePostController, {
    middleware: ["auth"],
    validation: {
        title: { type: "string" },
    },
});
```

#### Route Options

- **middleware**: Array of middleware names
- **validation**: Validation schema (automatic validation before handler)

### Validation

Validation is defined when registering routes and happens automatically:

```typescript
router.post("/users", CreateUserController, {
    validation: {
        title: {
            required: true,
            type: "string",
            minLength: 3,
            maxLength: 100,
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
        status: {
            enum: ["draft", "published"],
        },
    },
});

class CreateUserController extends Controller {
    async handle(context: RequestContext) {
        // Validation already happened - data is valid here
        return this.success(context.body);
    }
}
```

### Authentication

Set up JWT authentication:

```typescript
import { Auth, createAuthMiddleware } from "contro";

const auth = new Auth({
  secret: "your-secret-key",
  expiresIn: "24h",
});

// Register auth service
app.singleton("auth", () => auth);

// Register auth middleware
const middlewareManager = (app as any).middlewareManager;
middlewareManager.register("auth", createAuthMiddleware(auth));

// Use in controllers
@Get("/profile", ["auth"])
async profile(context: RequestContext) {
  return this.success({ message: "Protected route" });
}
```

### Middleware

Middleware can process requests before and after the controller:

```typescript
const timingMiddleware: Middleware = {
    async before(context) {
        (context.request as any)._startTime = Date.now();
        return null; // Continue
    },

    async after(context) {
        const duration = Date.now() - (context.request as any)._startTime;
        const headers = new Headers(context.response!.headers);
        headers.set("X-Response-Time", `${duration}ms`);

        return new Response(context.response!.body, {
            status: context.response!.status,
            headers,
        });
    },
};

// Global middleware
app.use(timingMiddleware);

// Named middleware
middlewareManager.register("timing", timingMiddleware);
router.get("/api/stats", StatsController, {
    middleware: ["timing"],
});
```

**Built-in middleware:**

```typescript
import { createCorsMiddleware, createRateLimitMiddleware } from "contro";

app.use(createCorsMiddleware({ origin: "*" }));
app.use(
    createRateLimitMiddleware({
        windowMs: 60000,
        maxRequests: 100,
    }),
);
```

### Dependency Injection

Register and resolve services:

```typescript
// Register singleton
app.singleton("database", () => new Database());

// Register transient
app.bind("logger", () => new Logger());

// Resolve
const db = app.resolve<Database>("database");
```

## Examples

Check the `examples/` directory for complete examples:

```bash
# Simple route registration
bun run examples/simple/app.ts

# Custom base controllers
bun run examples/custom-base-controllers/app.ts

# Middleware with before/after hooks
bun run examples/middleware-hooks/app.ts
```

## API Reference

### Application

- `new Application(config)` - Create app instance
- `app.use(middleware)` - Add global middleware
- `app.singleton(name, factory)` - Register singleton service
- `app.bind(name, factory)` - Register transient service
- `app.resolve(name)` - Resolve service
- `app.listen(port?, host?)` - Start server

### Controller Methods

- `this.json(data, status?)` - Return JSON response
- `this.success(data, message?)` - Return success response
- `this.error(message, status?, errors?)` - Return error response
- `this.validate(context, methodName)` - Validate request
- `this.redirect(url, status?)` - Return redirect
- `this.text(content, status?)` - Return text response
- `this.html(content, status?)` - Return HTML response

### Decorators

- `@ControllerDecorator(prefix)` - Define controller
- `@Get(path, middleware?)` - GET route
- `@Post(path, middleware?)` - POST route
- `@Put(path, middleware?)` - PUT route
- `@Patch(path, middleware?)` - PATCH route
- `@Delete(path, middleware?)` - DELETE route
- `@Validate(schema)` - Validate request
- `@MiddlewareDecorator(...names)` - Controller middleware

### Validation Rules

- `required` - Field is required
- `type` - Data type (string, number, boolean, email, url, array, object)
- `min/max` - Min/max value for numbers
- `minLength/maxLength` - Min/max length for strings/arrays
- `pattern` - Regex pattern
- `enum` - Allowed values
- `custom` - Custom validation function

## License

MIT
