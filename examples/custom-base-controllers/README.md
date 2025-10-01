# Custom Base Controllers

This example demonstrates how to extend the `Controller` class to create specialized base controllers for different types of routes.

## Why Custom Base Controllers?

Instead of repeating logic in every controller, create base controllers that:

- ✅ Handle authentication/authorization automatically
- ✅ Add logging, caching, or other cross-cutting concerns
- ✅ Provide helper methods for specific route types
- ✅ Enforce consistent behavior across similar routes

## Controller Lifecycle Hooks

The `Controller` class provides hooks you can override:

### `beforeHandle()`

Called **before** the main `handle()` method.

- Return `Response` to short-circuit and skip `handle()`
- Return `null` to continue to `handle()`
- Perfect for authentication, validation, caching checks

### `afterHandle(response)`

Called **after** the main `handle()` method.

- Modify or wrap the response
- Add logging, metrics, etc.
- Return the final response

### `context`

Protected property available in all methods containing:

- `request` - The original Request object
- `params` - Route parameters
- `query` - Query string parameters
- `body` - Parsed request body

## Example Base Controllers

### 1. AdminController

Automatically checks for admin authentication:

```typescript
abstract class AdminController extends Controller {
  protected async beforeHandle(): Promise<Response | null> {
    const authHeader = this.context.request.headers.get("Authorization");

    if (!authHeader || !authHeader.includes("admin-token")) {
      return this.error("Admin access required", 403);
    }

    return null; // Continue to handle()
  }

  protected getAdminUser() {
    return { id: "admin-1", name: "Admin User", role: "admin" };
  }
}

// Use it
class AdminDashboardController extends AdminController {
  async handle() {
    const admin = this.getAdminUser();
    return this.success({ admin, stats: {...} });
  }
}
```

### 2. AuthenticatedController

Requires user authentication:

```typescript
abstract class AuthenticatedController extends Controller {
    protected user: any;

    protected async beforeHandle(): Promise<Response | null> {
        const authHeader = this.context.request.headers.get("Authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return this.error("Authentication required", 401);
        }

        // Verify token and set user
        this.user = await verifyToken(authHeader);
        return null;
    }

    protected getCurrentUser() {
        return this.user;
    }
}

// Use it
class UserProfileController extends AuthenticatedController {
    async handle() {
        const user = this.getCurrentUser();
        return this.success({ profile: user });
    }
}
```

### 3. ApiController

Wraps all responses with API metadata:

```typescript
abstract class ApiController extends Controller {
    protected apiVersion = "v1";

    protected async afterHandle(response: any): Promise<any> {
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

// Use it
class ApiStatsController extends ApiController {
    async handle() {
        // Return plain data - afterHandle wraps it
        return { requests: 1000, users: 250 };
    }
}
```

### 4. CachedController

Adds simple caching:

```typescript
abstract class CachedController extends Controller {
    private static cache = new Map();
    protected cacheDuration = 60000; // 1 minute

    protected async beforeHandle(): Promise<Response | null> {
        const key = this.getCacheKey();
        const cached = CachedController.cache.get(key);

        if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
            return this.success(cached.data);
        }

        return null;
    }

    protected async afterHandle(response: any): Promise<any> {
        // Cache the response
        const key = this.getCacheKey();
        CachedController.cache.set(key, {
            data: response.data,
            timestamp: Date.now(),
        });
        return response;
    }
}
```

### 5. LoggingController

Logs all requests:

```typescript
abstract class LoggingController extends Controller {
    protected async beforeHandle(): Promise<Response | null> {
        console.log(
            `[${new Date().toISOString()}] ${this.context.request.method} ${this.context.request.url}`,
        );
        return null;
    }

    protected async afterHandle(response: any): Promise<any> {
        console.log(`Request completed successfully`);
        return response;
    }
}
```

## Running the Example

```bash
bun run examples/custom-base-controllers/app.ts
```

## Testing

### Public route

```bash
curl http://localhost:3000/
```

### Admin route (will fail)

```bash
curl http://localhost:3000/admin/dashboard
# Response: {"success":false,"message":"Admin access required"}
```

### Admin route (with token)

```bash
curl http://localhost:3000/admin/dashboard \
  -H "Authorization: admin-token"
```

### Authenticated route

```bash
curl http://localhost:3000/profile \
  -H "Authorization: Bearer user-token"
```

### API route (auto-wrapped)

```bash
curl http://localhost:3000/api/stats
# Response includes version and timestamp
```

### Cached route

```bash
# First request - fetches from "database"
curl http://localhost:3000/products

# Second request within 1 minute - returns cached
curl http://localhost:3000/products
```

## Best Practices

### 1. Keep Base Controllers Focused

Each base controller should handle ONE concern:

```typescript
// Good
class AdminController extends Controller {
    /* admin auth */
}
class CachedController extends Controller {
    /* caching */
}

// Bad
class AdminCachedLoggingController extends Controller {
    /* too much */
}
```

### 2. Use Composition Over Deep Inheritance

Don't chain too many base controllers:

```typescript
// Avoid
class MyController extends CachedController extends AdminController { }

// Instead, use middleware or separate concerns
```

### 3. Make Base Controllers Abstract

Force developers to implement `handle()`:

```typescript
abstract class AdminController extends Controller {
    // Implementation
}
```

### 4. Provide Helper Methods

Give subclasses useful utilities:

```typescript
abstract class AuthenticatedController extends Controller {
    protected getCurrentUser() {
        return this.user;
    }
    protected isAdmin() {
        return this.user.role === "admin";
    }
    protected can(permission: string) {
        /* check permission */
    }
}
```

### 5. Document Your Base Controllers

Make it clear what each base controller does and when to use it.

## Common Use Cases

### Authentication Levels

```typescript
abstract class GuestController extends Controller {}
abstract class AuthenticatedController extends Controller {}
abstract class AdminController extends Controller {}
abstract class SuperAdminController extends Controller {}
```

### API Versioning

```typescript
abstract class ApiV1Controller extends Controller {}
abstract class ApiV2Controller extends Controller {}
```

### Response Formatting

```typescript
abstract class JsonApiController extends Controller {}
abstract class GraphQLController extends Controller {}
abstract class RestController extends Controller {}
```

### Performance

```typescript
abstract class CachedController extends Controller {}
abstract class RateLimitedController extends Controller {}
```

### Logging/Monitoring

```typescript
abstract class LoggingController extends Controller {}
abstract class MetricsController extends Controller {}
```

## Advanced Example: Combining Concerns

```typescript
// Base controller with common API behavior
abstract class ApiController extends Controller {
    protected async afterHandle(response: any) {
        return this.json({
            version: "v1",
            timestamp: new Date().toISOString(),
            data: response,
        });
    }
}

// Authenticated API controller
abstract class AuthenticatedApiController extends ApiController {
    protected user: any;

    protected async beforeHandle(): Promise<Response | null> {
        // Auth logic
        this.user = await this.authenticate();
        if (!this.user) {
            return this.error("Unauthorized", 401);
        }
        return null;
    }

    protected getCurrentUser() {
        return this.user;
    }
}

// Use it
class UserApiController extends AuthenticatedApiController {
    async handle() {
        const user = this.getCurrentUser();
        return { user }; // Will be wrapped with API metadata
    }
}
```

## Benefits

✅ **DRY** - Don't repeat authentication/logging/etc in every controller  
✅ **Consistent** - All admin routes behave the same way  
✅ **Testable** - Test base controllers once, reuse everywhere  
✅ **Maintainable** - Change auth logic in one place  
✅ **Clear** - Route type is obvious from the base class

This pattern makes your codebase cleaner and more maintainable!
