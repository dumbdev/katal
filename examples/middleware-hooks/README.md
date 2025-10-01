# Middleware with Before and After Hooks

This example demonstrates the new middleware system that supports both `before` and `after` hooks, allowing middleware to process requests before the controller and modify responses after.

## Middleware Interface

```typescript
interface Middleware {
    // Called before the controller executes
    before?(
        context: MiddlewareContext,
    ): Promise<Response | null> | Response | null;

    // Called after the controller executes
    after?(context: MiddlewareContext): Promise<Response> | Response;
}

interface MiddlewareContext {
    request: Request;
    response?: Response; // Only available in after()
}
```

## Execution Flow

```
Request
  ↓
Global Middleware (before)
  ↓
Route Middleware (before)
  ↓
Controller
  ↓
Route Middleware (after)
  ↓
Global Middleware (after)
  ↓
Response
```

## Example Middleware

### 1. Logging Middleware

Logs before and after request:

```typescript
const loggingMiddleware: Middleware = {
    async before(context) {
        console.log(`${context.request.method} ${context.request.url}`);
        return null; // Continue
    },

    async after(context) {
        console.log(`Response: ${context.response!.status}`);
        return context.response!;
    },
};
```

### 2. Timing Middleware

Measures request duration:

```typescript
const timingMiddleware: Middleware = {
    async before(context) {
        (context.request as any)._startTime = Date.now();
        return null;
    },

    async after(context) {
        const duration = Date.now() - (context.request as any)._startTime;
        const response = context.response!;

        // Add timing header
        const headers = new Headers(response.headers);
        headers.set("X-Response-Time", `${duration}ms`);

        return new Response(response.body, {
            status: response.status,
            headers,
        });
    },
};
```

### 3. Response Wrapper Middleware

Wraps all JSON responses:

```typescript
const responseWrapperMiddleware: Middleware = {
    async after(context) {
        const response = context.response!;
        const data = await response.json();

        const wrapped = {
            success: response.status < 400,
            timestamp: new Date().toISOString(),
            data,
        };

        return new Response(JSON.stringify(wrapped), {
            status: response.status,
            headers: response.headers,
        });
    },
};
```

### 4. Security Headers Middleware

Adds security headers to responses:

```typescript
const securityHeadersMiddleware: Middleware = {
    async after(context) {
        const response = context.response!;
        const headers = new Headers(response.headers);

        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("X-Frame-Options", "DENY");
        headers.set("X-XSS-Protection", "1; mode=block");

        return new Response(response.body, {
            status: response.status,
            headers,
        });
    },
};
```

## Usage

### Global Middleware

Runs on all requests:

```typescript
app.use(loggingMiddleware);
app.use(timingMiddleware);
```

### Named Middleware

Register and apply to specific routes:

```typescript
// Register
middlewareManager.register("wrapper", responseWrapperMiddleware);
middlewareManager.register("security", securityHeadersMiddleware);

// Apply to routes
router.get("/users", UsersController, {
    middleware: ["wrapper"],
});

router.get("/secure", SecureController, {
    middleware: ["security", "wrapper"],
});
```

## Running the Example

```bash
bun run examples/middleware-hooks/app.ts
```

## Testing

### Basic route (only global middleware)

```bash
curl -i http://localhost:3000/
```

Check the headers:

- `X-Response-Time` - Request duration
- `X-Request-ID` - Unique request identifier

### Route with response wrapper

```bash
curl http://localhost:3000/users
```

Response is wrapped:

```json
{
  "success": true,
  "timestamp": "2025-09-30T...",
  "data": {
    "success": true,
    "data": [...]
  }
}
```

### Route with security headers

```bash
curl -i http://localhost:3000/secure
```

Check for security headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`

### Slow route (timing demonstration)

```bash
curl -i http://localhost:3000/slow
```

Check `X-Response-Time` header - should show ~2000ms

## Use Cases

### Before Hook

- **Authentication** - Verify tokens
- **Rate limiting** - Check request limits
- **Request validation** - Validate headers/body
- **Logging** - Log incoming requests
- **Request ID** - Generate unique IDs

### After Hook

- **Response transformation** - Wrap/modify responses
- **Compression** - Compress response body
- **Caching headers** - Add cache control
- **Security headers** - Add security headers
- **Logging** - Log responses
- **Metrics** - Track response times/sizes

## Benefits

✅ **Flexible** - Middleware can process before, after, or both  
✅ **Composable** - Chain multiple middleware together  
✅ **Powerful** - Modify requests and responses  
✅ **Clean** - Clear separation of concerns  
✅ **Reusable** - Write once, use anywhere

## Best Practices

1. **Keep middleware focused** - Each middleware should do one thing
2. **Order matters** - Middleware executes in registration order
3. **Return null in before()** - To continue to next middleware/controller
4. **Always return Response in after()** - Even if unchanged
5. **Handle errors** - Wrap in try/catch if needed
6. **Be mindful of performance** - Middleware runs on every request

## Advanced Example: Conditional Middleware

```typescript
const conditionalMiddleware: Middleware = {
    async before(context) {
        const url = new URL(context.request.url);

        // Only apply to /api/* routes
        if (url.pathname.startsWith("/api/")) {
            // Do something
        }

        return null;
    },

    async after(context) {
        const url = new URL(context.request.url);

        // Only modify /api/* responses
        if (url.pathname.startsWith("/api/")) {
            // Modify response
        }

        return context.response!;
    },
};
```

This pattern makes middleware incredibly powerful and flexible!
