import type { Server } from "bun";
import { Router } from "./Router.ts";
import { Container } from "./Container.ts";
import { MiddlewareManager } from "./MiddlewareManager.ts";
import type { Middleware, AppConfig } from "../types";

export class Application {
    private server?: Server;
    private readonly router: Router;
    private readonly container: Container;
    private readonly middlewareManager: MiddlewareManager;
    private readonly config: AppConfig;
    private booted = false;

    constructor(config: Partial<AppConfig> = {}) {
        this.config = {
            port: config.port ?? 3000,
            host: config.host ?? "localhost",
            cors: config.cors ?? false,
            bodyParser: config.bodyParser ?? true,
            ...config,
        };

        this.container = new Container();
        this.router = new Router();
        this.middlewareManager = new MiddlewareManager();

        // Register core services
        this.container.singleton("router", () => this.router);
        this.container.singleton("config", () => this.config);
    }

    /**
     * Register a singleton service in the container
     */
    singleton<T>(name: string, factory: () => T): this {
        this.container.singleton(name, factory);
        return this;
    }

    /**
     * Register a transient service in the container
     */
    bind<T>(name: string, factory: () => T): this {
        this.container.bind(name, factory);
        return this;
    }

    /**
     * Resolve a service from the container
     */
    resolve<T>(name: string): T {
        return this.container.resolve<T>(name);
    }

    /**
     * Register global middleware
     */
    use(middleware: Middleware): this {
        this.middlewareManager.addGlobal(middleware);
        return this;
    }

    /**
     * Get the router instance
     */
    getRouter(): Router {
        return this.router;
    }

    /**
     * Get the container instance
     */
    getContainer(): Container {
        return this.container;
    }

    /**
     * Boot the application
     */
    async boot(): Promise<void> {
        if (this.booted) return;

        // Run boot logic here (service providers, etc.)
        this.booted = true;
    }

    /**
     * Start the HTTP server
     */
    async listen(port?: number, host?: string): Promise<void> {
        await this.boot();

        const serverPort = port ?? this.config.port;
        const serverHost = host ?? this.config.host;

        this.server = Bun.serve({
            port: serverPort,
            hostname: serverHost,
            fetch: async (request) => {
                try {
                    // Execute global middleware before phase
                    const middlewareResult =
                        await this.middlewareManager.executeGlobalBefore(
                            request,
                        );
                    if (middlewareResult) return middlewareResult;

                    // Route the request
                    let response = await this.router.handle(
                        request,
                        this.middlewareManager,
                    );

                    // Execute global middleware after phase
                    response = await this.middlewareManager.executeGlobalAfter(
                        request,
                        response,
                    );

                    return response;
                } catch (error) {
                    console.error("Request error:", error);
                    return new Response(
                        JSON.stringify({
                            error: "Internal Server Error",
                            message:
                                error instanceof Error
                                    ? error.message
                                    : "Unknown error",
                        }),
                        {
                            status: 500,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }
            },
        });

        console.log(`🚀 Server running at http://${serverHost}:${serverPort}`);
    }

    /**
     * Stop the server
     */
    async stop(): Promise<void> {
        if (this.server) {
            this.server.stop();
            console.log("Server stopped");
        }
    }
}
