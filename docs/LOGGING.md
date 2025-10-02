# Logging

## Overview
Contro's logging system provides a flexible, extensible logging solution with multiple destinations and log levels.

## Features
- Multiple log levels (DEBUG, INFO, WARN, ERROR)
- Multiple concurrent destinations (Console, File)
- Colored console output
- Structured logging with context
- Error stack traces
- Atomic file writes
- Asynchronous operation

## Basic Usage

```typescript
import { LoggingIntegration, LogLevel } from 'contro/logging';

const logger = new LoggingIntegration()
    .setMinLevel(LogLevel.INFO)
    .toConsole()
    .toFile('./logs/app.log');

// Basic logging
await logger.info('Application started');
await logger.error('Error occurred', new Error('Something went wrong'));

// Logging with context
await logger.info('User action', {
    userId: 123,
    action: 'login'
});
```

## Log Levels

```typescript
enum LogLevel {
    DEBUG = "debug",
    INFO = "info",
    WARN = "warn",
    ERROR = "error"
}
```

## Destinations

### Console Destination
Provides colored output to the console with formatted messages:

```typescript
const logger = new LoggingIntegration()
    .toConsole();

// Outputs with color based on level:
// [2025-10-02T12:34:56.789Z] INFO  Message
// [2025-10-02T12:34:56.789Z] ERROR Error message
```

### File Destination
Writes logs to a file with atomic operations:

```typescript
const logger = new LoggingIntegration()
    .toFile('./logs/app.log');

// Creates file if it doesn't exist
// Appends logs atomically
// Handles concurrent writes safely
```

### Custom Destinations
Implement your own destinations by implementing the LogDestination interface:

```typescript
interface LogDestination {
    write(entry: LogEntry): Promise<void> | void;
}

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: Date;
    context?: Record<string, any>;
    error?: Error;
}

// Example Database Destination
class DatabaseDestination implements LogDestination {
    async write(entry: LogEntry): Promise<void> {
        await db.logs.create({
            level: entry.level,
            message: entry.message,
            timestamp: entry.timestamp,
            context: entry.context,
            error: entry.error?.message
        });
    }
}

// Usage
logger.addDestination(new DatabaseDestination());
```

## Error Handling
The logging system handles errors gracefully:

```typescript
// Destination errors are caught and logged
try {
    await logger.error('Failed operation', error);
} catch (e) {
    // Logging failures don't throw to application code
}

// File system errors are handled
const logger = new LoggingIntegration()
    .toFile('./invalid/path/app.log'); // Will handle directory creation errors
```

## Best Practices

1. Configure Different Log Levels
```typescript
// Development
const logger = new LoggingIntegration()
    .setMinLevel(LogLevel.DEBUG)
    .toConsole();

// Production
const logger = new LoggingIntegration()
    .setMinLevel(LogLevel.INFO)
    .toFile('./logs/app.log')
    .toFile('./logs/error.log', { minLevel: LogLevel.ERROR });
```

2. Use Structured Logging
```typescript
await logger.info('API Request', {
    method: 'POST',
    path: '/users',
    duration: 123,
    statusCode: 200
});
```

3. Include Error Context
```typescript
try {
    await someOperation();
} catch (error) {
    await logger.error('Operation failed', error, {
        operationName: 'someOperation',
        input: data
    });
}
```

4. Use Method Chaining
```typescript
const logger = new LoggingIntegration()
    .setMinLevel(LogLevel.INFO)
    .toConsole()
    .toFile('./logs/app.log')
    .addDestination(new CustomDestination());
```
