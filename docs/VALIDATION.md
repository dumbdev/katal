# Validation

## Overview
Contro's validation system provides a type-safe validation framework built on explicit schema definitions. Validation is automatically handled by the Controller base class when a schema is defined.

## Basic Usage

```typescript
import { Controller, ValidationSchema } from 'contro';

class CreateUserController extends Controller {
    // Define validation schema - validation happens automatically
    protected schema: ValidationSchema = {
        name: {
            required: true,
            type: 'string',
            minLength: 2
        },
        email: {
            required: true,
            type: 'email'
        },
        age: {
            type: 'number',
            min: 18
        }
    };

    async handle(context: RequestContext) {
        // At this point, validation has already passed
        // and context.body contains the validated data
        const { name, email, age } = context.body;
        
        // Create user with validated data
        const user = await this.createUser({ name, email, age });
        return this.success(user);
    }
}
```

## How It Works

When a request is handled by a controller:

1. The framework checks if the controller has a `schema` property
2. If present, the request body is validated against the schema
3. If validation fails, a 422 error response is returned automatically
4. If validation passes, the `handle` method is called with validated data in `context.body`

### Manual Validation

You can also validate data manually using the `validateRequest` method:

```typescript
class CustomController extends Controller {
    async handle(context: RequestContext) {
        const schema: ValidationSchema = {
            id: { required: true, type: 'number' }
        };

        // Returns null if valid, or a Response with validation errors
        const validationError = this.validateRequest(context, schema);
        if (validationError) {
            return validationError;
        }

        // Validation passed
        const { id } = context.body;
        // ... continue processing
    }
}
```

## Validation Types

### ValidationRule Interface
```typescript
interface ValidationRule {
    required?: boolean;
    type?: "string" | "number" | "boolean" | "email" | "url" | "array" | "object";
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    custom?: (value: any) => boolean | string;
    enum?: any[];
    schema?: ValidationSchema;
}

interface ValidationSchema {
    [key: string]: ValidationRule;
}
```

### Basic Type Validation
```typescript
const schema: ValidationSchema = {
    // String validation
    username: {
        type: 'string',
        required: true,
        minLength: 3
    },

    // Number validation
    age: {
        type: 'number',
        min: 18,
        max: 150
    },

    // Boolean validation
    active: {
        type: 'boolean'
    }
};
```

### Special Types
```typescript
const schema: ValidationSchema = {
    // Email validation (built-in)
    email: {
        type: 'email',
        required: true
    },

    // URL validation (built-in)
    website: {
        type: 'url'
    }
};
```

### Pattern & Enum Validation
```typescript
const schema: ValidationSchema = {
    // Regular expression pattern
    username: {
        type: 'string',
        pattern: /^[a-zA-Z0-9_]+$/
    },

    // Enum values
    role: {
        type: 'string',
        enum: ['admin', 'user', 'guest']
    }
};
```

### Custom Validation
```typescript
const schema: ValidationSchema = {
    password: {
        type: 'string',
        custom: (value) => {
            if (!/[A-Z]/.test(value)) {
                return 'Password must contain an uppercase letter';
            }
            if (!/[0-9]/.test(value)) {
                return 'Password must contain a number';
            }
            return true;
        }
    }
};
```

### Nested Objects
```typescript
const schema: ValidationSchema = {
    profile: {
        type: 'object',
        schema: {
            name: { required: true, type: 'string' },
            contact: {
                type: 'object',
                schema: {
                    email: { type: 'email' },
                    phone: { type: 'string', pattern: /^\+?[\d\s-]{10,}$/ }
                }
            }
        }
    }
};
```

### Array Validation
```typescript
const schema: ValidationSchema = {
    // Simple array
    tags: {
        type: 'array',
        minLength: 1
    },

    // Array with object schema
    items: {
        type: 'array',
        schema: {
            name: { required: true, type: 'string' },
            price: { type: 'number', min: 0 }
        }
    }
};
```

## Error Handling

```typescript
interface ValidationError {
    field: string;    // Field path (includes nested paths)
    message: string;  // Error message
}

// Example validation response
{
    "errors": [
        {
            "field": "email",
            "message": "email is required"
        },
        {
            "field": "profile.contact.phone",
            "message": "profile.contact.phone format is invalid"
        }
    ]
}
```

## Best Practices

1. Use Built-in Types When Available
```typescript
// Prefer this:
const schema: ValidationSchema = {
    email: { type: 'email' }
};

// Over this:
const schema: ValidationSchema = {
    email: {
        type: 'string',
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    }
};
```

2. Clear Error Messages
```typescript
const schema: ValidationSchema = {
    age: {
        type: 'number',
        custom: (value) => {
            return value >= 21 || 'Must be 21 years or older';
        }
    }
};
```

3. Type-Safe Schemas
```typescript
interface CreateUserInput {
    username: string;
    email: string;
    profile: {
        firstName: string;
        lastName: string;
    };
}

const schema: ValidationSchema = {
    username: { required: true, type: 'string' },
    email: { required: true, type: 'email' },
    profile: {
        type: 'object',
        schema: {
            firstName: { required: true, type: 'string' },
            lastName: { required: true, type: 'string' }
        }
    }
} as const;
```
