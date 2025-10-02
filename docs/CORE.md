# Core Features

## Application

The Application class is the central component of the framework, providing HTTP server capabilities with middleware and routing.

### Core Features
- HTTP Server (powered by Bun)
- Dependency Injection Container
- Middleware System
- Routing
- Request/Response Handling

### Basic Usage
```typescript
import { Application } from 'contro';

const app = new Application({
    port: 3000,
    host: 'localhost',
    cors: false,
    bodyParser: true
});

// Start the server
await app.listen();
```

### Middleware
```typescript
// Global middleware
app.use({
    async before(context) {
        // Pre-process request
        // Return Response to short-circuit, or null to continue
        return null;
    },
    async after(context) {
        // Post-process response
        return context.response!;
    }
});

// Named middleware
app.registerMiddleware('auth', {
    async before({ request }) {
        const token = request.headers.get('Authorization');
        if (!token) {
            return new Response('Unauthorized', { status: 401 });
        }
        return null;
    }
});
```

### Dependency Injection
```typescript
// Register a singleton
app.singleton('cache', () => new CacheService());

// Register a transient service
app.bind('logger', () => new Logger());

// Resolve a service
const cache = app.resolve<CacheService>('cache');
```

### Request Handling
```typescript
import { Controller } from 'contro';

class UserController extends Controller {
    async handle(request: Request) {
        const data = await request.json();
        return this.json({ success: true, data });
    }
}

app.getRouter().post('/users', UserController);
```

### Configuration
The Application accepts the following configuration options:
```typescript
interface AppConfig {
    port: number;      // Default: 3000
    host: string;      // Default: "localhost"
    cors: boolean;     // Default: false
    bodyParser: boolean; // Default: true
}
```

### Request Context
Each route handler receives a context object:
```typescript
interface RequestContext {
    request: Request;
    params: Record<string, string>;  // URL parameters
    query: Record<string, string>;   // Query string parameters
    body: any;                       // Parsed request body
}
```

### Error Handling
The framework includes built-in error handling:
```typescript
try {
    // Your code
} catch (error) {
    return new Response(
        JSON.stringify({
            error: "Internal Server Error",
            message: error instanceof Error ? error.message : "Unknown error"
        }),
        {
            status: 500,
            headers: { "Content-Type": "application/json" }
        }
    );
}
```

### Server Lifecycle
```typescript
// Boot without starting server
await app.boot();

// Start server
await app.listen(3000, 'localhost');

// Stop server
await app.stop();
```
