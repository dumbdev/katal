# Authentication

## Overview
Katal provides a built-in authentication system using JWT (JSON Web Tokens) with a simplified, secure implementation that works with Bun's crypto capabilities.

## Basic Usage

```typescript
import { Auth } from 'katal/auth';

// Initialize auth with configuration
const auth = new Auth({
    secret: 'your-secret-key',
    expiresIn: '1h'  // Expiration as string (e.g., '1h', '7d') or number of seconds
});
```

## Token Management

### Generating Tokens
```typescript
const user = {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com'
};

const token = await auth.generateToken(user);
```

### Verifying Tokens
```typescript
const token = request.headers.get('Authorization')?.split(' ')[1];
if (token) {
    const user = await auth.verifyToken(token);
    if (user) {
        // Token is valid, user is authenticated
        console.log('Authenticated user:', user);
    }
}
```

### Password Management
```typescript
// Hash a password
const hashedPassword = await auth.hashPassword('user-password');

// Verify a password
const isValid = await auth.verifyPassword('user-password', hashedPassword);
```

## Auth Middleware

```typescript
import { AuthMiddleware } from 'katal/middleware';

// Protect routes with authentication
app.registerMiddleware('auth', new AuthMiddleware(auth));

// Use in routes
router.get('/profile', ['auth'], ProfileController);
```

## Request Authentication

In your controllers, you can access the authenticated user:

```typescript
class ProfileController extends Controller {
    async handle(context: RequestContext) {
        const token = context.request.headers.get('Authorization')?.split(' ')[1];
        if (!token) {
            return this.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await this.resolve<Auth>('auth').verifyToken(token);
        if (!user) {
            return this.json({ error: 'Invalid token' }, { status: 401 });
        }

        return this.json({ user });
    }
}
```

## Configuration

```typescript
interface AuthConfig {
    secret: string;           // Secret key for token signing
    expiresIn: string | number; // Token expiration
}
```

## Security Features

- Token Signature Verification
- Expiration Validation
- Password Hashing using Bun's crypto
- Base64Url Encoding/Decoding
- Prevention of Token Tampering

## Best Practices

1. Store Secret Key Securely
   ```typescript
   const auth = new Auth({
       secret: process.env.JWT_SECRET!,
       expiresIn: '1h'
   });
   ```

2. Use HTTPS in Production
   ```typescript
   const app = new Application({
       // ... other config
   });
   ```

3. Implement Token Refresh Logic
   ```typescript
   class AuthController extends Controller {
       async refresh(context: RequestContext) {
           const refreshToken = context.request.headers.get('X-Refresh-Token');
           // Implement your refresh logic
       }
   }
   ```

4. Handle Token Expiration
   ```typescript
   class AuthMiddleware implements Middleware {
       async before({ request }) {
           const token = request.headers.get('Authorization')?.split(' ')[1];
           if (!token) {
               return new Response('Unauthorized', { status: 401 });
           }

           const user = await this.auth.verifyToken(token);
           if (!user) {
               return new Response('Token expired or invalid', { status: 401 });
           }

           return null;
       }
   }
   ```
