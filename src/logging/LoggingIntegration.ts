import type { BunFile } from "bun";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Log levels for categorizing log messages
 */
export enum LogLevel {
    DEBUG = "debug",
    INFO = "info",
    WARN = "warn",
    ERROR = "error",
}

/**
 * Log entry structure
 */
export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: Date;
    context?: Record<string, any>;
    error?: Error;
}

/**
 * Interface for custom log destinations
 */
export interface LogDestination {
    write(entry: LogEntry): Promise<void> | void;
}

/**
 * Console log destination - logs to console with colors
 */
export class ConsoleDestination implements LogDestination {
    private colors = {
        debug: "\x1b[36m", // Cyan
        info: "\x1b[32m",  // Green
        warn: "\x1b[33m",  // Yellow
        error: "\x1b[31m", // Red
        reset: "\x1b[0m",
    };

    write(entry: LogEntry): void {
        const color = this.colors[entry.level];
        const timestamp = entry.timestamp.toISOString();
        const level = entry.level.toUpperCase().padEnd(5);

        let message = `${color}[${timestamp}] ${level}${this.colors.reset} ${entry.message}`;

        if (entry.context && Object.keys(entry.context).length > 0) {
            message += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`;
        }

        if (entry.error) {
            message += `\n  Error: ${entry.error.message}`;
            if (entry.error.stack) {
                message += `\n  Stack: ${entry.error.stack}`;
            }
        }

        console.log(message);
    }
}

/**
 * File log destination - logs to a file
 */
export class FileDestination implements LogDestination {
    constructor(private filePath: string) {
        try {
            const dir = dirname(filePath);
            if (dir !== "." && !existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
        } catch (error) {
            // Ignore directory creation errors - we'll handle them during write
        }
    }

    async write(entry: LogEntry): Promise<void> {
        const timestamp = entry.timestamp.toISOString();
        const level = entry.level.toUpperCase().padEnd(5);
        let line = `[${timestamp}] ${level} ${entry.message}`;

        if (entry.context && Object.keys(entry.context).length > 0) {
            line += ` | Context: ${JSON.stringify(entry.context)}`;
        }

        if (entry.error) {
            line += ` | Error: ${entry.error.message}`;
            if (entry.error.stack) {
                line += ` | Stack: ${entry.error.stack}`;
            }
        }

        line += "\n";

        try {
            appendFileSync(this.filePath, line, { flag: 'a' });
        } catch (error) {
            const message = `Failed to write to log file: ${this.filePath}`;
            console.error(message);
            throw new Error(message);
        }
    }
}

/**
 * LoggingIntegration - Flexible logging system for controllers
 */
export class LoggingIntegration {
    private destinations: LogDestination[] = [];
    private minLevel: LogLevel = LogLevel.DEBUG;

    /**
     * Add a log destination
     */
    addDestination(destination: LogDestination): this {
        this.destinations.push(destination);
        return this;
    }

    /**
     * Set minimum log level (logs below this level will be ignored)
     */
    setMinLevel(level: LogLevel): this {
        this.minLevel = level;
        return this;
    }

    /**
     * Log to console
     */
    toConsole(): this {
        return this.addDestination(new ConsoleDestination());
    }

    /**
     * Log to file
     */
    toFile(filePath: string): this {
        return this.addDestination(new FileDestination(filePath));
    }

    /**
     * Check if a log level should be logged
     */
    private shouldLog(level: LogLevel): boolean {
        const levels = [
            LogLevel.DEBUG,
            LogLevel.INFO,
            LogLevel.WARN,
            LogLevel.ERROR,
        ];
        const minIndex = levels.indexOf(this.minLevel);
        const currentIndex = levels.indexOf(level);
        return currentIndex >= minIndex;
    }

    /**
     * Write a log entry to all destinations
     */
    private async log(
        level: LogLevel,
        message: string,
        context?: Record<string, any>,
        error?: Error,
    ): Promise<void> {
        if (!this.shouldLog(level)) {
            return;
        }

        const entry: LogEntry = {
            level,
            message,
            timestamp: new Date(),
            context,
            error,
        };

        const errors: Error[] = [];

        // Handle destinations sequentially to avoid race conditions
        for (const dest of this.destinations) {
            try {
                await Promise.resolve(dest.write(entry));
            } catch (error) {
                const errorMessage = `Failed to write to destination ${dest.constructor.name}`;
                console.error(errorMessage, error);
                errors.push(error as Error);
            }
        }

        // If all destinations failed, throw an error
        if (errors.length === this.destinations.length && this.destinations.length > 0) {
            throw new Error("All destinations failed to write");
        }
    }

    /**
     * Log debug message
     */
    async debug(message: string, context?: Record<string, any>): Promise<void> {
        await this.log(LogLevel.DEBUG, message, context);
    }

    /**
     * Log info message
     */
    async info(message: string, context?: Record<string, any>): Promise<void> {
        await this.log(LogLevel.INFO, message, context);
    }

    /**
     * Log warning message
     */
    async warn(message: string, context?: Record<string, any>): Promise<void> {
        await this.log(LogLevel.WARN, message, context);
    }

    /**
     * Log error message
     */
    async error(
        message: string,
        error?: Error,
        context?: Record<string, any>,
    ): Promise<void> {
        await this.log(LogLevel.ERROR, message, context, error);
    }
}
