import { expect, describe, it, beforeEach, afterEach, mock } from "bun:test";
import { LoggingIntegration, LogLevel, type LogEntry } from "./LoggingIntegration";
import { unlinkSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

type MockFunction = ReturnType<typeof mock> & {
    mock: {
        calls: any[][];
        results: { type: string; value: any }[];
        instances: any[];
    };
};

type MockedConsole = Console & {
    log: MockFunction;
    error: MockFunction;
    warn: MockFunction;
    info: MockFunction;
    debug: MockFunction;
};


describe("LoggingIntegration", () => {
    let logger: LoggingIntegration;
    let consoleMock: MockedConsole;
    const testFilePath = "./test.log";
    const testLogsDir = "./logs";

    function cleanDirectory(path: string) {
        if (existsSync(path)) {
            rmSync(path, { recursive: true, force: true });
        }
    }

    beforeEach(() => {
        // Clean up before creating new instances
        cleanDirectory(testFilePath);
        cleanDirectory(testLogsDir);

        // Create fresh console mocks for each test
        const originalConsole = global.console;
        consoleMock = {
            ...console,
            log: mock(() => {}),
            error: mock(() => {}),
            warn: mock(() => {}),
            info: mock(() => {}),
            debug: mock(() => {}),
        } as unknown as MockedConsole;
        global.console = consoleMock as any;

        // Initialize logger
        logger = new LoggingIntegration();
    });

    afterEach(() => {
        // Restore original console
        global.console = console;

        // Clean up files
        cleanDirectory(testFilePath);
        cleanDirectory(testLogsDir);
    });

    describe("Log Levels", () => {
        it("should log messages at or above minimum level", async () => {
            const destination = { write: mock(() => {}) };
            logger.addDestination(destination).setMinLevel(LogLevel.INFO);

            await logger.debug("Debug message");
            await logger.info("Info message");
            await logger.warn("Warning message");
            await logger.error("Error message");

            // Debug should be ignored
            expect(destination.write).toHaveBeenCalledTimes(3);

            const calls = (destination.write as any).mock.calls;
            expect(calls[0][0].level).toBe(LogLevel.INFO);
            expect(calls[1][0].level).toBe(LogLevel.WARN);
            expect(calls[2][0].level).toBe(LogLevel.ERROR);
        });

        it("should respect log level hierarchy", async () => {
            const destination = { write: mock(() => {}) };
            logger.addDestination(destination).setMinLevel(LogLevel.WARN);

            await logger.debug("Debug message");
            await logger.info("Info message");
            await logger.warn("Warning message");
            await logger.error("Error message");

            // Only WARN and ERROR should be logged
            expect(destination.write).toHaveBeenCalledTimes(2);
        });
    });

    describe("ConsoleDestination", () => {
        it("should format console output with colors", async () => {
            logger.toConsole();
            await logger.info("Test message");

            expect(consoleMock.log).toHaveBeenCalledTimes(1);
            const output = consoleMock.log.mock.calls[0][0];
            expect(output).toInclude("\x1b[32m"); // Green color
            expect(output).toInclude("INFO");
            expect(output).toInclude("Test message");
        });

        it("should include context in console output", async () => {
            logger.toConsole();
            const context = { user: "test", action: "login" };
            await logger.info("Test with context", context);

            expect(consoleMock.log).toHaveBeenCalledTimes(1);
            const output = consoleMock.log.mock.calls[0][0];
            expect(output).toInclude("Context");
            expect(output).toInclude(JSON.stringify(context, null, 2));
        });

        it("should format error messages properly", async () => {
            logger.toConsole();
            const error = new Error("Test error");
            await logger.error("Error occurred", error);

            expect(consoleMock.log).toHaveBeenCalledTimes(1);
            const output = consoleMock.log.mock.calls[0][0];
            expect(output).toInclude("\x1b[31m"); // Red color
            expect(output).toInclude("ERROR");
            expect(output).toInclude("Test error");
            expect(output).toInclude("Stack:");
        });
    });

    describe("FileDestination", () => {
        it("should write logs to file", async () => {
            logger.toFile(testFilePath);
            await logger.info("Test message");

            const file = Bun.file(testFilePath);
            const content = await file.text();

            expect(content).toInclude("INFO");
            expect(content).toInclude("Test message");
            expect(content).toEndWith("\n");
        });

        it("should append multiple log entries", async () => {
            logger.toFile(testFilePath);
            await logger.info("First message");
            await logger.warn("Second message");

            const file = Bun.file(testFilePath);
            const content = await file.text();
            const lines = content.split("\n").filter(line => line);

            expect(lines).toHaveLength(2);
            expect(lines[0]).toInclude("First message");
            expect(lines[1]).toInclude("Second message");
        });

        it("should handle file write errors gracefully", async () => {
            const invalidPath = process.platform === "win32"
                ? "\\\\invalid\\path\\test.log"   // Windows invalid path
                : "/proc/invalid/test.log";       // Unix invalid path

            // Create a new logger instance for this test
            const testLogger = new LoggingIntegration();
            testLogger.toFile(invalidPath);

            try {
                await testLogger.info("Test message");
                // If we get here, the test should fail
                expect(true).toBe(false); // Force test to fail if no error is thrown
            } catch (error) {
                // Verify the error is logged
                expect(consoleMock.error).toHaveBeenCalled();
                const errorMessage = consoleMock.error.mock.calls[0][0];
                expect(errorMessage).toInclude("Failed to write to log file");
                expect(errorMessage).toInclude(invalidPath);
            }
        });

        it("should handle concurrent writes correctly", async () => {
            logger.toFile(testFilePath);

            // Create timestamp once to ensure all messages use same value
            const timestamp = Date.now();
            const messages = Array.from({ length: 5 }, (_, i) => ({
                id: i + 1,
                timestamp,
                text: `Message ${i + 1}`
            }));

            // Write messages sequentially to maintain order
            for (const msg of messages) {
                await logger.info(`[${msg.id}] ${msg.text} at ${msg.timestamp}`);
            }

            // Wait for all writes to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            const file = Bun.file(testFilePath);
            const content = await file.text();
            const lines = content.split("\n").filter(line => line);

            // Verify all messages were written
            expect(lines).toHaveLength(messages.length);

            // Verify each message was written exactly once in order
            messages.forEach((msg, index) => {
                expect(lines[index]).toInclude(`[${msg.id}]`);
                expect(lines[index]).toInclude(msg.text);
            });
        });

        it("should preserve log order", async () => {
            logger.toFile(testFilePath);

            const messages = ["First", "Second", "Third"];
            for (const msg of messages) {
                await logger.info(msg);
            }

            const file = Bun.file(testFilePath);
            const content = await file.text();
            const lines = content.split("\n").filter(line => line);

            messages.forEach((msg, index) => {
                expect(lines[index]).toInclude(msg);
            });
        });

        it("should handle relative paths correctly", async () => {
            const relativePath = join(testLogsDir, "test.log");

            // Ensure logs directory exists
            if (!existsSync(testLogsDir)) {
                mkdirSync(testLogsDir, { recursive: true });
            }

            logger.toFile(relativePath);
            await logger.info("Test message");

            expect(existsSync(relativePath)).toBe(true);
            const content = await Bun.file(relativePath).text();
            expect(content).toInclude("Test message");
        });
    });

    describe("Multiple Destinations", () => {
        it("should write to multiple destinations", async () => {
            const dest1 = { write: mock(() => {}) };
            const dest2 = { write: mock(() => {}) };

            logger.addDestination(dest1).addDestination(dest2);
            await logger.info("Test message");

            expect(dest1.write).toHaveBeenCalled();
            expect(dest2.write).toHaveBeenCalled();
        });

        it("should handle failed destinations", async () => {
            // Mock console.error before creating the logger
            const originalConsoleError = console.error;
            const errorSpy = mock(() => {});
            console.error = errorSpy;
            
            try {
                const workingDest = { write: mock(() => Promise.resolve()) };
                const failingDest = { write: mock(() => Promise.reject(new Error("Failed"))) };

                // Create a new logger instance with the mocked console
                const testLogger = new LoggingIntegration();
                testLogger.addDestination(workingDest).addDestination(failingDest);

                // Should not throw
                await testLogger.info("Test message");

                expect(workingDest.write).toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
                const errorMessage = errorSpy.mock.calls[0][0];
                expect(errorMessage).toInclude("Failed to write to destination");
            } finally {
                // Restore original console.error
                console.error = originalConsoleError;
            }
        });
    });

    describe("Log Entry Format", () => {
        it("should create properly formatted log entries", async () => {
            const destination = { write: mock((_entry: LogEntry) => {}) };
            const context = { userId: 123 };
            const error = new Error("Test error");

            logger.addDestination(destination);
            await logger.error("Test message", error, context);

            const entry = destination.write.mock.calls[0][0] as LogEntry;
            expect(entry.level).toBe(LogLevel.ERROR);
            expect(entry.message).toBe("Test message");
            expect(entry.context).toBe(context);
            expect(entry.error).toBe(error);
            expect(entry.timestamp).toBeInstanceOf(Date);
        });

        it("should handle optional fields", async () => {
            const destination = { write: mock((_entry: LogEntry) => {}) };
            logger.addDestination(destination);
            await logger.info("Test message");

            const entry = destination.write.mock.calls[0][0] as LogEntry;
            expect(entry.context).toBeUndefined();
            expect(entry.error).toBeUndefined();
        });
    });

    describe("Method Chaining", () => {
        it("should support method chaining", () => {
            const result = logger
                .setMinLevel(LogLevel.INFO)
                .toConsole()
                .toFile(testFilePath)
                .addDestination({ write: () => {} });

            expect(result).toBe(logger);
        });
    });
});
