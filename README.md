# Katal

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/katal.svg)](https://www.npmjs.com/package/katal)
[![Bun](https://img.shields.io/badge/Bun-💖-white)](https://bun.sh/)

> A simple yet powerful web framework for Bun with TypeScript, inspired by Laravel and Express

## 🚀 Features

- 🚀 **Built for Bun** - Leverage Bun's native performance and TypeScript support
- 🎯 **Controller-based** - One controller per route for better organization
- 🔒 **JWT Authentication** - Out-of-the-box JWT support
- 🛡️ **Middleware System** - Global and route-specific middleware support
- ✅ **Request Validation** - Built-in validation with custom rules
- 📦 **Dependency Injection** - Built-in IoC container
- ⚡ **Performance** - Optimized for Bun's runtime
- 🌐 **CORS** - Built-in CORS middleware
- 🚦 **Rate Limiting** - Protect your APIs from abuse
- 🔧 **Extensible** - Create custom base controllers and middleware
- 📝 **Type-Safe** - Full TypeScript support
- 🧪 **Testing** - Built with testability in mind

## Installation

```bash
bun install katal
```

## 🚀 Quick Start

### Installation

```bash
# Create a new project
mkdir my-katal-app
cd my-katal-app
bun init -y
bun add katal
```

### Basic Example

Create a simple API server with a few endpoints:

```typescript
// app.ts
import { Application, Controller } from "katal";
import type { RequestContext } from "katal";

const app = new Application({ port: 3000 });
const router = app.getRouter();

// Health check endpoint
class HealthController extends Controller {
    async handle() {
        return this.success({
            status: "ok",
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
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

// Create a new user
class CreateUserController extends Controller {
    async handle(context: RequestContext) {
        // In a real app, you would save to a database here
        const user = {
            id: Math.random().toString(36).substr(2, 9),
            ...context.body,
            createdAt: new Date().toISOString()
        };
        
        return this.success(user, "User created successfully", 201);
    }
}

// Register routes
router.get("/health", HealthController);
router.get("/users", GetUsersController);
router.post("/users", CreateUserController, {
    validation: {
        name: { 
            required: true, 
            type: "string", 
            minLength: 2,
            maxLength: 100 
        },
        email: { 
            required: true, 
            type: "email" 
        },
        age: {
            type: "number",
            min: 13,
            max: 120
        }
    },
    // Optional: Add middleware to this specific route
    middleware: ["log-request"]
});

// Add global middleware (applied to all routes)
import { createCorsMiddleware } from "katal";
app.use(createCorsMiddleware({ 
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// Start the server
app.listen(() => {
    console.log(`Server running on http://localhost:${app.port}`);    
    console.log(`Environment: ${app.environment}`);
});
```

Run your application:

```bash
bun run app.ts
```

Test the API:

```bash
# Health check
curl http://localhost:3000/health

# Get all users
curl http://localhost:3000/users

# Create a new user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","age":28}'
```

## 📚 Documentation

### 🎛️ Controllers

Controllers are the heart of your Katal application. Each controller handles exactly one route and extends the base `Controller` class.

#### Basic Controller Example

```typescript
import { Controller } from 'katal';
import type { RequestContext } from 'katal';

class GetUserController extends Controller {
    async handle(context: RequestContext) {
        const { id } = context.params;
        
        // Access request data
        const { query } = context;
        
        // Return success response
        return this.success({
            id,
            name: 'John Doe',
            email: 'john@example.com'
        });
    }
}
```

#### Response Helpers

Katal provides several response helpers in the base `Controller` class:

```typescript
// Success response with data (returns 200 OK)
return this.success(data);

// Success with custom message
return this.success(data, 'Operation successful');

// Error response with custom status code
return this.error('User not found', 404);

// Validation error with error details
return this.validationError([{ field: 'email', message: 'Invalid email' }]);

// Redirect to another URL
return this.redirect('https://example.com');

// Custom JSON response with status code
return this.json({ custom: 'response' }, 201);

// Plain text response
return this.text('Hello, world!');

// HTML response
return this.html('<h1>Hello, world!</h1>');
```

#### Lifecycle Hooks

Controllers support these lifecycle hooks:

```typescript
class ExampleController extends Controller {
    // Called before handle()
    async beforeHandle(): Promise<Response | null> {
        // Return null to continue
        // Or return a Response to short-circuit
        if (!this.isAuthenticated()) {
            return this.error('Unauthorized', 401);
        }
        return null;
    }

    // Main handler
    async handle(context: RequestContext) {
        // Your route logic here
        return this.success({ data: 'example' });
    }

    // Called after handle()
    async afterHandle(response: Response): Promise<Response> {
        // Modify response if needed
        response.headers.set('X-Custom-Header', 'value');
        return response;
    }
}
```

### 🛡️ Middleware

Middleware in Katal allows you to process requests and responses. You can create middleware with `before` and `after` hooks that run around your route handlers.

#### Middleware Interface

```typescript
interface Middleware {
    before?: (context: MiddlewareContext) => Promise<Response | void> | Response | void;
    after?: (context: MiddlewareContext) => Promise<Response> | Response;
}

interface MiddlewareContext {
    request: Request;
    response?: Response;
    [key: string]: any; // For custom properties
}
```

#### Built-in Middleware

Katal comes with several useful middleware:

```typescript
import { 
    createCorsMiddleware, 
    createRateLimitMiddleware,
    createAuthMiddleware,
    Auth
} from 'katal';

// CORS middleware
app.use(createCorsMiddleware({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Rate limiting (100 requests per 15 minutes per IP)
app.use(createRateLimitMiddleware({
    windowMs: 15 * 60 * 1000,
    maxRequests: 100
}));

// JWT Authentication
const auth = new Auth({
    secret: 'your-secret-key-change-in-production',
    expiresIn: '24h'
});

// Register auth service and middleware
app.singleton('auth', () => auth);

// Register auth middleware using the new registerMiddleware method
app.registerMiddleware('auth', createAuthMiddleware(auth));
```

#### Custom Middleware Examples

1. **Logging Middleware**:

```typescript
const loggingMiddleware: Middleware = {
    async before(context) {
        const url = new URL(context.request.url);
        console.log(`📝 [${new Date().toISOString()}] ${context.request.method} ${url.pathname}`);
        (context.request as any)._startTime = Date.now();
        return null; // Continue to next middleware/route
    },
    
    async after(context) {
        const duration = Date.now() - (context.request as any)._startTime;
        console.log(`✅ [${new Date().toISOString()}] ${context.request.method} ${context.request.url} - ${context.response?.status} (${duration}ms)`);
        return context.response!;
    }
};

// Register globally
app.use(loggingMiddleware);
```

2. **Request ID Middleware**:

```typescript
const requestIdMiddleware: Middleware = {
    async before(context) {
        const requestId = Math.random().toString(36).substr(2, 9);
        (context.request as any)._requestId = requestId;
        return null;
    },
    
    async after(context) {
        const requestId = (context.request as any)._requestId;
        const response = context.response!;
        
        // Add request ID to response headers
        const headers = new Headers(response.headers);
        headers.set('X-Request-ID', requestId);
        
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers
        });
    }
};

// Register globally
app.use(requestIdMiddleware);
```

3. **Route-Specific Middleware**:

```typescript
// Create a named middleware
const adminAuthMiddleware: Middleware = {
    async before(context) {
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || !authHeader.includes('admin-token')) {
            return new Response(
                JSON.stringify({ error: 'Admin access required' }), 
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            );
        }
        return null;
    }
};

// Register the named middleware
app.singleton('adminAuth', () => adminAuthMiddleware);

// Use in routes
router.get('/admin/dashboard', AdminDashboardController, {
    middleware: ['adminAuth']
});
```

#### Middleware Execution Order

1. Global middleware (in registration order)
   - `before` hooks run first-to-last
   - `after` hooks run last-to-first
2. Route-specific middleware (in the order specified in route options)
   - `before` hooks run after global middleware
   - `after` hooks run before global middleware's `after` hooks
3. Controller's `beforeHandle` method
4. Controller's `handle` method
5. Controller's `afterHandle` method
```

### 🔌 Error Handling

Katal provides built-in error handling with the following features:

1. **Global Error Handling**:
   - All uncaught errors are caught and returned as JSON responses
   - 500 status code for unexpected errors
   - 404 for non-existent routes
   - 422 for validation errors

2. **Controller Error Helpers**:
   ```typescript
   // Return a 400 Bad Request error
   return this.error('Invalid input', 400);
   
   // Return a validation error (422 Unprocessable Entity)
   const errors = [
       { field: 'email', message: 'Invalid email format' },
       { field: 'password', message: 'Password too short' }
   ];
   return this.validationError(errors);
   
   // Return a 404 Not Found
   return this.error('User not found', 404);
   ```

3. **Custom Error Handling**:
   For custom error handling, you can extend the base Controller class:
   
   ```typescript
   class BaseController extends Controller {
       protected handleError(error: Error): Response {
           // Log the error
           console.error('Controller error:', error);
           
           // Handle specific error types
           if (error instanceof DatabaseError) {
               return this.error('Database error', 503);
           }
           
           // Default error handling
           return this.error('Something went wrong', 500);
       }
   }
   ```

4. **Validation Errors**:
   When using the built-in validation, validation errors are automatically handled:
   
   ```typescript
   // In your controller
   const { valid, errors } = Validator.validate(data, validationSchema);
   if (!valid) {
       return this.validationError(errors);
   }
   ```
   
   This will return a response like:
   ```json
   {
       "success": false,
       "message": "Validation failed",
       "errors": [
           { "field": "email", "message": "Invalid email format" },
           { "field": "password", "message": "Password too short" }
       ]
   }
   ```
```

### 🏗️ Custom Base Controllers

Katal allows you to create custom base controllers to encapsulate common functionality and reduce code duplication. Here are some practical examples:

#### 1. Admin Controller

```typescript
abstract class AdminController extends Controller {
    protected override async beforeHandle(): Promise<Response | null> {
        const authHeader = this.context.request.headers.get("Authorization");
        if (!authHeader || !authHeader.includes("admin-token")) {
            return this.error("Admin access required", 403);
        }
        return null;
    }

    protected getAdminUser() {
        return {
            id: "admin-1",
            name: "Admin User",
            role: "admin",
        };
    }
}

// Usage
class AdminDashboardController extends AdminController {
    async handle() {
        const admin = this.getAdminUser();
        return this.success({ admin, stats: { totalUsers: 1000 } });
    }
}
```

#### 2. API Controller with Standardized Responses

```typescript
abstract class ApiController extends Controller {
    protected apiVersion = "v1";

    protected override async afterHandle(response: any): Promise<any> {
        if (response instanceof Response) return response;
        
        return this.json({
            version: this.apiVersion,
            timestamp: new Date().toISOString(),
            data: response,
        });
    }
}

// Usage
class StatsController extends ApiController {
    async handle() {
        // Returns: { version: "v1", timestamp: "...", data: { ... } }
        return { requests: 1000, users: 250 };
    }
}
```

#### 3. Authenticated Controller

```typescript
abstract class AuthenticatedController extends Controller {
    protected user: any;

    protected override async beforeHandle(): Promise<Response | null> {
        const authHeader = this.context.request.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return this.error("Authentication required", 401);
        }
        
        // In a real app, verify JWT token
        this.user = await this.verifyToken(authHeader.split(" ")[1]);
        return null;
    }

    protected getCurrentUser() {
        return this.user;
    }
}
```

#### 4. Cached Controller

```typescript
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
            return this.success(cached.data);
        }
        return null;
    }

    protected override async afterHandle(response: any): Promise<any> {
        if (response instanceof Response && response.status === 200) {
            const key = this.getCacheKey();
            const data = await response.clone().json();
            CachedController.cache.set(key, {
                data: data.data,
                timestamp: Date.now(),
            });
        }
        return response;
    }
}

// Usage
class ProductsController extends CachedController {
    async handle() {
        // This will be cached for 1 minute
        return this.success([
            { id: 1, name: "Product 1" },
            { id: 2, name: "Product 2" },
        ]);
    }
}
```

#### 5. Logging Controller

```typescript
abstract class LoggingController extends Controller {
    protected override async beforeHandle(): Promise<Response | null> {
        console.log(
            `📝 [${new Date().toISOString()}] ${this.context.request.method} ${new URL(this.context.request.url).pathname}`
        );
        return null;
    }

    protected override async afterHandle(response: any): Promise<any> {
        console.log(`✅ Request completed with status: ${response.status}`);
        return response;
    }
}

// Usage
class HealthController extends LoggingController {
    async handle() {
        return this.success({ status: "ok" });
    }
}
```

### 🌐 Routing

Katal provides a flexible routing system that works alongside controllers. Routes are defined separately from controllers for better organization.

#### Basic Routing

```typescript
import { Application } from 'katal';

const app = new Application({ port: 3000 });
const router = app.getRouter();

// Basic GET route
router.get('/hello', HelloController);

// Route with URL parameters
router.get('/users/:id', GetUserController);

// Route with query parameters
// Example: /search?q=term&page=1
router.get('/search', SearchController);

// All HTTP methods are supported
router.post('/users', CreateUserController);
router.put('/users/:id', UpdateUserController);
router.delete('/users/:id', DeleteUserController);
router.patch('/users/:id', PatchUserController);
```

#### Route Groups

Group related routes with common middleware or path prefixes:

```typescript
// Group with path prefix
router.group('/api/v1', (router) => {
    router.get('/users', GetUsersController);
    router.post('/users', CreateUserController);
    
    // Nested groups
    router.group('/admin', (router) => {
        router.get('/dashboard', AdminDashboardController);
        router.get('/stats', AdminStatsController);
    }, {
        middleware: ['auth', 'admin']
    });
});
```

### ✅ Validation

Katal includes a powerful validation system that's easy to use and extend.

#### Basic Validation

In Katal, request validation is handled using the `validateRequest` method in your controller. Here's how to implement validation:

```typescript
import { Controller } from 'katal';
import type { RequestContext } from 'katal';

class RegisterController extends Controller {
    // Define your validation schema as a class property
    private readonly registerSchema = {
        username: {
            required: true,
            type: 'string',
            minLength: 3,
            maxLength: 30,
            pattern: /^[a-zA-Z0-9_]+$/  // Only alphanumeric and underscores
        },
        email: {
            required: true,
            type: 'email',  // Built-in email type
            maxLength: 255
        },
        age: {
            type: 'number',
            min: 18,
            max: 120
        },
        isAdmin: {
            type: 'boolean'
        },
        website: {
            type: 'url',  // Built-in URL type
            required: false
        },
        role: {
            type: 'string',
            enum: ['user', 'editor', 'admin']
        },
        preferences: {
            type: 'object',
            required: true,
            schema: {
                theme: {
                    type: 'string',
                    enum: ['light', 'dark', 'system']
                },
                notifications: {
                    type: 'boolean',
                    required: true
                },
                language: {
                    type: 'string',
                    enum: ['en', 'es', 'fr', 'de']
                }
            }
        },
        tags: {
            type: 'array',
            min: 1,
            max: 10,
            items: 'string'
        },
        customField: {
            type: 'string',
            custom: (value: string) => {
                // Custom validation function
                // Return true if valid, false or error message if invalid
                if (value.length % 2 === 0) {
                    return true;
                }
                return 'Value must have an even number of characters';
            }
        }
    };

    async handle() {
        // Validate the request
        const validationResponse = this.validateRequest(this.context, this.registerSchema);
        if (validationResponse) {
            return validationResponse;
        }

        // If validation passes, continue with registration logic
        const { username, email, password } = this.context.body;
        
        // Your registration logic here...
        
        return this.success({ userId: 123 }, 'Registration successful');
    }
}

// In your routes file:
router.post('/register', RegisterController);
```

#### Custom Validators

You can create custom validation rules using the `custom` validator function. The function should return `true` if the value is valid, or a string error message if invalid.

```typescript
import { Controller } from 'katal';

class UserController extends Controller {
    private readonly updatePasswordSchema = {
        currentPassword: { 
            required: true, 
            type: 'string' 
        },
        newPassword: {
            required: true,
            type: 'string',
            minLength: 8,
            custom: (value: string) => {
                if (typeof value !== 'string') return 'Password must be a string';
                if (value.length < 8) return 'Password must be at least 8 characters';
                if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter';
                if (!/[a-z]/.test(value)) return 'Password must contain at least one lowercase letter';
                if (!/\d/.test(value)) return 'Password must contain at least one number';
                return true; // Validation passed
            }
        },
        confirmPassword: {
            required: true,
            type: 'string',
            custom: (value: string, data: any) => {
                if (value !== data.newPassword) {
                    return 'Passwords do not match';
                }
                return true;
            }
        }
    };

    async updatePassword() {
        const validation = this.validateRequest(this.context, this.updatePasswordSchema);
        if (validation) return validation;
        
        // Continue with password update logic
        const { currentPassword, newPassword } = this.context.body;
        // ...
        
        return this.success({ message: 'Password updated successfully' });
    }
}
```

#### Built-in Validators

Katal provides several built-in validators through the `type` property:

- `'string'` - Validates string values
- `'number'` - Validates numeric values
- `'boolean'` - Validates boolean values
- `'email'` - Validates email format
- `'url'` - Validates URL format
- `'array'` - Validates arrays (use `items` to validate array elements)
- `'object'` - Validates objects (use `schema` to validate object properties)

Example using built-in validators:

```typescript
const schema = {
    username: {
        type: 'string',
        minLength: 3,
        maxLength: 30,
        pattern: /^[a-z0-9_]+$/
    },
    email: {
        type: 'email',
        required: true
    },
    age: {
        type: 'number',
        min: 18,
        max: 120
    },
    roles: {
        type: 'array',
        items: {
            type: 'string',
            enum: ['user', 'editor', 'admin']
        },
        min: 1
    },
    metadata: {
        type: 'object',
        schema: {
            lastLogin: { type: 'string' },
            preferences: { type: 'object' }
        }
    }
};
```

### 🔐 Authentication & Authorization

Katal provides built-in JWT authentication through the `Auth` class. Here's how to implement it in your application.

#### Setup Authentication

```typescript
import { Auth, createAuthMiddleware } from 'katal';

// Initialize auth with your secret key
const auth = new Auth({
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: '24h' // Token expiration
});

// Register auth service in the container
app.singleton('auth', () => auth);

// Register auth middleware
const middlewareManager = (app as any).middlewareManager;
middlewareManager.register('auth', createAuthMiddleware(auth));
```

#### User Registration

```typescript
class RegisterController extends Controller {
    async handle(context: RequestContext) {
        const { email, password, name } = context.body;
        const auth = app.resolve<Auth>('auth');

        // Hash the password
        const hashedPassword = await auth.hashPassword(password);

        // In a real app, save to database
        const user = {
            id: Math.random().toString(36).substr(2, 9),
            email,
            name,
            password: hashedPassword,
        };

        // Generate JWT token
        const token = await auth.generateToken(user);

        return this.success({
            user: { 
                id: user.id, 
                email: user.email, 
                name: user.name 
            },
            token,
        });
    }
}
```

#### User Login

```typescript
class LoginController extends Controller {
    async handle(context: RequestContext) {
        const { email, password } = context.body;
        const auth = app.resolve<Auth>('auth');

        // In a real app, fetch user from database
        const user = {
            id: "123",
            email: "demo@example.com",
            name: "Demo User",
            password: await auth.hashPassword("password123"),
        };

        // Verify password
        const isValid = await auth.verifyPassword(password, user.password);

        if (!isValid) {
            return this.error("Invalid credentials", 401);
        }

        // Generate token
        const token = await auth.generateToken(user);

        return this.success({
            user: { 
                id: user.id, 
                email: user.email, 
                name: user.name 
            },
            token,
        });
    }
}
```

#### Protecting Routes

```typescript
// Public route
router.get('/public', PublicController);

// Protected route - requires authentication
router.get('/profile', ProfileController, {
    middleware: ['auth']
});

// Protected route with role check
class AdminDashboardController extends Controller {
    async handle() {
        // Access the authenticated user from context
        const user = this.context.user;
        
        // Check user role
        if (user.role !== 'admin') {
            return this.error('Admin access required', 403);
        }
        
        return this.success({
            message: 'Welcome to the admin dashboard',
            stats: { /* ... */ }
        });
    }
}

// Register admin route
router.get('/admin/dashboard', AdminDashboardController, {
    middleware: ['auth']
});
```

#### Auth Methods

The `Auth` class provides these methods:

```typescript
// Hash a password
const hashed = await auth.hashPassword('mypassword');

// Verify a password
const isValid = await auth.verifyPassword('mypassword', hashed);

// Generate JWT token
const token = await auth.generateToken({ id: '123', role: 'user' });

// Verify token (done automatically by middleware)
const payload = await auth.verifyToken(token);
```

#### Token Usage

Include the token in the `Authorization` header:

```http
GET /protected-route
Authorization: Bearer your-jwt-token-here
```

Or as a query parameter:
```
GET /protected-route?token=your-jwt-token-here
```

#### Token Refresh

For implementing token refresh, create a refresh token endpoint:

```typescript
class RefreshTokenController extends Controller {
    async handle() {
        const auth = app.resolve<Auth>('auth');
        const user = this.context.user; // From current token
        
        // Generate new token with extended expiration
        const newToken = await auth.generateToken({
            id: user.id,
            role: user.role
        });
        
        return this.success({ token: newToken });
    }
}

// Register refresh token route
router.post('/auth/refresh', RefreshTokenController, {
    middleware: ['auth'] // Requires a valid (but possibly expired) token
});
```
    }
}

// Login
class LoginController extends Controller {
    async handle({ body }) {
        const { email, password } = body;
        
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return this.error('Invalid credentials', 401);
        }
        
        // Verify password
        const isValid = await Bun.password.verify(password, user.password);
        if (!isValid) {
            return this.error('Invalid credentials', 401);
        }
        
        // Generate JWT token
        const token = auth.signToken({ userId: user.id });
        
        // Set auth cookie
        this.setCookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7 // 7 days
        });
        
        return this.success({
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        }, 'Login successful');
    }
}
```

### 📝 Logging

Katal provides a powerful and flexible logging system through the `LoggingIntegration` class, allowing you to log messages at different severity levels and route them to various destinations.

#### Log Levels

Katal supports four log levels:

```typescript
enum LogLevel {
    DEBUG = "debug",  // Detailed debug information
    INFO = "info",    // General application flow
    WARN = "warn",    // Warnings that don't prevent execution
    ERROR = "error"   // Errors that need attention
}
```

#### Basic Usage

```typescript
import { LoggingIntegration, LogLevel } from 'katal';

// Create a logger instance
const logger = new LoggingIntegration()
    .setMinLevel(LogLevel.INFO)  // Set minimum log level
    .toConsole();                // Log to console

// Log messages
await logger.debug('Debug message', { some: 'context' });
await logger.info('User logged in', { userId: 123, ip: '192.168.1.1' });
await logger.warn('API rate limit approaching', { endpoint: '/api/users' });
await logger.error('Database connection failed', new Error('Connection timeout'));
```

#### Log Destinations

Katal comes with built-in destinations and allows custom ones:

```typescript
// Log to console with colors (default)
logger.toConsole();

// Log to a file
logger.toFile('logs/app.log');

// Custom destination example (e.g., to a remote service)
const remoteLogging = {
    async write(entry) {
        await fetch('https://logs.example.com/api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry)
        });
    }
};

logger.addDestination(remoteLogging);
```

#### Request Logging Middleware

Here's how to create a request logging middleware:

```typescript
import { LoggingIntegration } from 'katal';

const logger = new LoggingIntegration()
    .setMinLevel(LogLevel.INFO)
    .toConsole()
    .toFile('logs/requests.log');

const requestLogger = {
    async before(context) {
        // Store start time for duration calculation
        (context.request as any)._startTime = Date.now();
        
        // Log request start
        await logger.info('Request started', {
            method: context.request.method,
            url: context.request.url,
            ip: context.request.headers.get('x-forwarded-for') || 
                context.request.headers.get('x-real-ip') ||
                context.request.headers.get('cf-connecting-ip') ||
                'unknown'
        });
        
        return null; // Continue to next middleware
    },
    
    async after(context) {
        const { request, response } = context;
        const duration = Date.now() - (request as any)._startTime;
        
        // Log request completion
        await logger.info('Request completed', {
            method: request.method,
            url: request.url,
            status: response?.status,
            duration: `${duration}ms`,
            'response-size': response?.headers.get('content-length') || 'unknown'
        });
        
        return response;
    }
};

// Register middleware
app.use(requestLogger);
```

#### Error Logging

For comprehensive error handling and logging:

```typescript
// Global error handler
app.onError = async (error: Error, context: any) => {
    await logger.error('Unhandled error', error, {
        url: context?.request?.url,
        method: context?.request?.method,
        params: context?.params,
        query: context?.query,
        body: context?.body
    });
    
    return new Response(
        JSON.stringify({ 
            error: 'Internal Server Error',
            requestId: context?.requestId 
        }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
};

// In a controller
class UserController extends Controller {
    async handle() {
        try {
            // Your code here
        } catch (error) {
            // Log the error with context
            await logger.error('Failed to process user', error, {
                userId: this.context.params.id,
                action: 'updateProfile'
            });
            
            // Return error response
            return this.error('Failed to process request', 500);
        }
    }
}
```

### 🚀 Deployment

Deploying your Katal application is straightforward. Here's how to deploy to various platforms:

#### 1. Local Development

```bash
# Install dependencies
bun install

# Start development server with hot reloading
bun run dev
```

#### 2. Production Build

```bash
# Install production dependencies (with --production flag)
bun install --production

# Build your application (if needed)
bun run build

# Start production server
bun start
```

#### 3. Environment Variables

Create a `.env` file in your project root:

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=your-secure-secret
DATABASE_URL=your-database-url
```

#### 4. Process Manager (PM2)

Install PM2 globally:

```bash
bun add -g pm2
```

Create an ecosystem file `ecosystem.config.js`:

```javascript
module.exports = {
    apps: [{
        name: 'my-katal-app',
        script: 'app.js',
        instances: 'max',
        exec_mode: 'cluster',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        }
    }]
};
```

Start your application:

```bash
pm2 start ecosystem.config.js
```

#### 5. Docker Deployment

Create a `Dockerfile`:

```dockerfile
# Use the official Bun image
FROM oven/bun:latest

# Set working directory
WORKDIR /app

# Copy package.json and bun.lockb
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --production

# Copy the rest of the application
COPY . .

# Build the application (if needed)
# RUN bun run build

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["bun", "start"]
```

Build and run the Docker container:

```bash
# Build the image
docker build -t my-katal-app .

# Run the container
docker run -p 3000:3000 --env-file .env my-katal-app
```

#### 6. Deployment to Platforms

Katal can be deployed to any platform that supports Node.js applications:

- **Vercel**: Use the [Bun runtime](https://vercel.com/docs/runtimes#official-runtimes/node-js/bun-runtime)
- **Railway**: Supports Bun out of the box
- **Render.com**: Use a custom build command with Bun
- **AWS Lambda**: Use the [AWS Lambda runtime for Bun](https://github.com/oven-sh/bun#aws-lambda)

### 📦 Advanced Topics

#### Dependency Injection

Katal includes a simple yet powerful dependency injection container:

```typescript
// Register a service
app.singleton('database', () => new Database(process.env.DATABASE_URL));

// In a controller
class UserController extends Controller {
    private database = this.app.make('database');
    
    async handle() {
        const users = await this.database.query('SELECT * FROM users');
        return this.success(users);
    }
}
```

### 📚 Examples

Check out the `examples/` directory for complete examples:

- `examples/simple/` - Basic API example
- `examples/custom-base-controllers/` - Extending base controllers
- `examples/middleware-hooks/` - Middleware and hooks examples

### 🤝 Contributing

Contributions are welcome! Please read our [contributing guide](CONTRIBUTING.md) to get started.

### 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### 🙏 Acknowledgments

- Built with ❤️ and [Bun](https://bun.sh/)
- Inspired by Laravel, Express, and other amazing frameworks
- Thanks to all [contributors](https://github.com/dumbdev/katal/graphs/contributors) who helped shape this project


## License

MIT
