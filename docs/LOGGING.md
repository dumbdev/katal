# Logging Integration

The `LoggingIntegration` class provides a flexible logging system for controllers in the Contro framework. It supports multiple log destinations (console, file, database, etc.) and different log levels.

## Features

- **Multiple Log Levels**: DEBUG, INFO, WARN, ERROR
- **Multiple Destinations**: Console, File, or custom destinations
- **Structured Logging**: Include context data with your logs
- **Error Logging**: Log errors with stack traces
- **Extensible**: Create custom log destinations
- **Chainable API**: Fluent interface for configuration

## Basic Usage

### Console Logging

```typescript
class MyController extends Controller {
    async handle() {
        const logger = this.LoggingIntegration().toConsole();

        await logger.info("User logged in", { userId: 123 });
        await logger.warn("Low disk space");
        await logger.error("Database connection failed", error);

        return this.success({ message: "Done" });
    }
}
```

### File Logging

```typescript
class MyController extends Controller {
    async handle() {
        const logger = this.LoggingIntegration().toFile("./logs/app.log");

        await logger.info("Request processed", {
            path: this.context.request.url,
            method: this.context.request.method,
        });

        return this.success({ message: "Logged to file" });
    }
}
```

### Multiple Destinations

```typescript
class MyController extends Controller {
    async handle() {
        // Log to both console and file
        const logger = this.LoggingIntegration()
            .toConsole()
            .toFile("./logs/app.log");

        await logger.info("This goes to both destinations");

        return this.success({ message: "Done" });
    }
}
```

## Log Levels

The framework supports four log levels:

- **DEBUG**: Detailed information for debugging
- **INFO**: General informational messages
- **WARN**: Warning messages
- **ERROR**: Error messages

### Setting Minimum Log Level

```typescript
const logger = this.LoggingIntegration().toConsole().setMinLevel(LogLevel.INFO); // Only log INFO, WARN, and ERROR

await logger.debug("This won't be logged");
await logger.info("This will be logged");
```

## Custom Log Destinations

You can create custom log destinations by implementing the `LogDestination` interface:

```typescript
import type { LogDestination, LogEntry } from "contro";

class DatabaseDestination implements LogDestination {
    async write(entry: LogEntry): Promise<void> {
        // Save to database
        await db.logs.insert({
            level: entry.level,
            message: entry.message,
            timestamp: entry.timestamp,
            context: entry.context,
            error: entry.error,
        });
    }
}

// Use it in your controller
class MyController extends Controller {
    async handle() {
        const logger = this.LoggingIntegration()
            .toConsole()
            .addDestination(new DatabaseDestination());

        await logger.info("This goes to console and database");

        return this.success({ message: "Done" });
    }
}
```

### Example: Slack Destination

```typescript
class SlackDestination implements LogDestination {
    constructor(private webhookUrl: string) {}

    async write(entry: LogEntry): Promise<void> {
        // Only send errors to Slack
        if (entry.level !== LogLevel.ERROR) return;

        await fetch(this.webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: `🚨 Error: ${entry.message}`,
                attachments: [
                    {
                        color: "danger",
                        fields: [
                            {
                                title: "Timestamp",
                                value: entry.timestamp.toISOString(),
                            },
                            {
                                title: "Context",
                                value: JSON.stringify(entry.context),
                            },
                        ],
                    },
                ],
            }),
        });
    }
}
```

### Example: Email Destination

```typescript
class EmailDestination implements LogDestination {
    constructor(
        private emailService: EmailService,
        private recipients: string[],
    ) {}

    async write(entry: LogEntry): Promise<void> {
        // Only send critical errors via email
        if (entry.level !== LogLevel.ERROR) return;

        await this.emailService.send({
            to: this.recipients,
            subject: `[ERROR] ${entry.message}`,
            body: `
        Timestamp: ${entry.timestamp.toISOString()}
        Message: ${entry.message}
        Context: ${JSON.stringify(entry.context, null, 2)}
        Error: ${entry.error?.message}
        Stack: ${entry.error?.stack}
      `,
        });
    }
}
```

## Advanced Usage

### Logging with Context

```typescript
const logger = this.LoggingIntegration().toConsole();

await logger.info("User action", {
    userId: this.user.id,
    action: "purchase",
    productId: 123,
    amount: 99.99,
    timestamp: new Date().toISOString(),
});
```

### Logging Errors

```typescript
try {
    await someOperation();
} catch (error) {
    const logger = this.LoggingIntegration().toConsole();

    await logger.error("Operation failed", error as Error, {
        operation: "someOperation",
        userId: 123,
    });

    return this.error("Operation failed");
}
```

### Conditional Logging

```typescript
const logger = this.LoggingIntegration().toConsole();

if (process.env.NODE_ENV === "production") {
    logger.setMinLevel(LogLevel.WARN);
} else {
    logger.setMinLevel(LogLevel.DEBUG);
}
```

### Reusing Logger Instance

The logger is cached per controller instance, so you can call `LoggingIntegration()` multiple times:

```typescript
class MyController extends Controller {
    async handle() {
        // First call creates and configures the logger
        const logger = this.LoggingIntegration()
            .toConsole()
            .toFile("./logs/app.log");

        await logger.info("Step 1");

        // Subsequent calls return the same instance
        const sameLogger = this.LoggingIntegration();
        await sameLogger.info("Step 2");

        return this.success({ message: "Done" });
    }
}
```

## API Reference

### LoggingIntegration Methods

- **`toConsole()`**: Add console destination
- **`toFile(filePath: string)`**: Add file destination
- **`addDestination(destination: LogDestination)`**: Add custom destination
- **`setMinLevel(level: LogLevel)`**: Set minimum log level
- **`debug(message: string, context?: Record<string, any>)`**: Log debug message
- **`info(message: string, context?: Record<string, any>)`**: Log info message
- **`warn(message: string, context?: Record<string, any>)`**: Log warning message
- **`error(message: string, error?: Error, context?: Record<string, any>)`**: Log error message

### LogEntry Interface

```typescript
interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: Date;
    context?: Record<string, any>;
    error?: Error;
}
```

### LogDestination Interface

```typescript
interface LogDestination {
    write(entry: LogEntry): Promise<void> | void;
}
```

## Best Practices

1. **Use appropriate log levels**: DEBUG for development, INFO for general events, WARN for potential issues, ERROR for failures
2. **Include context**: Always include relevant context data to make logs more useful
3. **Don't log sensitive data**: Avoid logging passwords, tokens, or personal information
4. **Use structured logging**: Pass context as objects rather than concatenating strings
5. **Configure per environment**: Use different log levels and destinations for development vs production
6. **Implement log rotation**: For file logging, implement log rotation to prevent disk space issues
7. **Monitor error logs**: Set up alerts for ERROR level logs in production

## Examples

See the complete examples in:

- `examples/custom-base-controllers/app.ts` - Basic logging examples
- `examples/logging/` - Advanced logging patterns (coming soon)
