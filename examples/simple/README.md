# Simple Route Registration

This is the **recommended** way to use Contro. Each controller handles a single route, and routes are registered outside the controller.

## Philosophy

- **One controller, one route** - Each controller has a single responsibility
- **Routes registered externally** - All routes defined in one place
- **Clean separation** - Controllers focus on business logic, routing is separate

## Basic Structure

```typescript
// 1. Define a controller - handles ONE route
class GetUsersController extends Controller {
    async handle(context: RequestContext) {
        return this.success(users);
    }
}

// 2. Register the route - outside the controller
router.get("/users", GetUsersController);
```

## With Validation

```typescript
// Controller
class CreateUserController extends Controller {
    async handle(context: RequestContext) {
        const { name, email } = context.body;
        // Validation already happened automatically
        return this.success({ id: 1, name, email });
    }
}

// Route registration with validation
router.post("/users", CreateUserController, {
    validation: {
        name: { required: true, type: "string" },
        email: { required: true, type: "email" },
    },
});
```

## With Middleware

```typescript
// Controller
class ProfileController extends Controller {
    async handle(context: RequestContext) {
        return this.success({ user: "data" });
    }
}

// Route registration with middleware
router.get("/profile", ProfileController, {
    middleware: ["auth"],
});
```

## Complete Example

```typescript
import { Application, Controller } from "contro";
import type { RequestContext } from "contro";

const app = new Application({ port: 3000 });
const router = app.getRouter();

// Controllers
class HealthController extends Controller {
    async handle() {
        return this.success({ status: "ok" });
    }
}

class GetUsersController extends Controller {
    async handle() {
        return this.success([
            { id: 1, name: "John" },
            { id: 2, name: "Jane" },
        ]);
    }
}

class CreateUserController extends Controller {
    async handle(context: RequestContext) {
        return this.success(context.body, "User created");
    }
}

// Route registration
router.get("/health", HealthController);
router.get("/users", GetUsersController);
router.post("/users", CreateUserController, {
    validation: {
        name: { required: true, type: "string" },
        email: { required: true, type: "email" },
    },
});

app.listen();
```

## Route Options

When registering a route, you can pass options as the third parameter:

```typescript
router.post("/path", ControllerClass, {
    middleware: ["auth", "admin"], // Array of middleware names
    validation: {
        // Validation schema
        field: { required: true, type: "string" },
    },
});
```

## Benefits

### ✅ Single Responsibility

Each controller does ONE thing - handles ONE route.

### ✅ Easy to Find

Want to know what handles `/users`? Look at the route registration.

### ✅ Easy to Test

Test controllers in isolation without worrying about routing.

### ✅ Clear Overview

All routes visible in one place - easy to see your API structure.

### ✅ Flexible

Easy to add/remove/modify routes without touching controllers.

### ✅ No Magic

No decorators, no reflection, just plain TypeScript classes.

## Running the Example

```bash
bun run examples/simple/app.ts
```

## Testing

### Health check

```bash
curl http://localhost:3000/health
```

### Get all users

```bash
curl http://localhost:3000/users
```

### Create a user (with validation)

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","age":25}'
```

### Test validation errors

```bash
# Missing required field
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com"}'

# Invalid email
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"invalid"}'
```

### Register

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com","password":"password123"}'
```

### Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"password123"}'
```

### Access protected route

```bash
# Get token from login, then:
curl http://localhost:3000/protected/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Organization Tips

### Option 1: All controllers in one file (small apps)

```typescript
// app.ts
class HealthController extends Controller { ... }
class GetUsersController extends Controller { ... }
class CreateUserController extends Controller { ... }

router.get("/health", HealthController);
router.get("/users", GetUsersController);
router.post("/users", CreateUserController);
```

### Option 2: Separate files (larger apps)

```
src/
  controllers/
    HealthController.ts
    GetUsersController.ts
    CreateUserController.ts
  routes.ts  // All route registrations
  app.ts     // Application setup
```

```typescript
// routes.ts
import { Router } from "contro";
import { HealthController } from "./controllers/HealthController";
import { GetUsersController } from "./controllers/GetUsersController";

export function registerRoutes(router: Router) {
    router.get("/health", HealthController);
    router.get("/users", GetUsersController);
}

// app.ts
import { Application } from "contro";
import { registerRoutes } from "./routes";

const app = new Application();
registerRoutes(app.getRouter());
app.listen();
```

## Comparison with Other Approaches

### This Approach (Recommended)

```typescript
class GetUsersController extends Controller {
    async handle() {
        return this.success(users);
    }
}

router.get("/users", GetUsersController);
```

**Pros**: Simple, clear, testable, no magic  
**Cons**: Slightly more verbose for very simple apps

### Old Decorator Approach (Not Recommended)

```typescript
@ControllerDecorator("/users")
class UserController extends Controller {
    @Get("/")
    async index() {
        return this.success(users);
    }
}
```

**Pros**: Less code  
**Cons**: Decorator complexity, harder to test, magic metadata

## Best Practices

1. **One controller per route** - Keep it focused
2. **Name controllers by action** - `GetUsersController`, not `UsersController`
3. **Keep controllers thin** - Move business logic to services
4. **Register routes in one place** - Easy to see your API structure
5. **Use validation options** - Let the framework handle validation

This is the cleanest, most maintainable way to build APIs with Contro!
