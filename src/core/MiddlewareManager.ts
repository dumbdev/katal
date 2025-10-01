import type { Middleware, MiddlewareContext } from "../types";

export class MiddlewareManager {
    private globalMiddleware: Middleware[] = [];
    private namedMiddleware = new Map<string, Middleware>();

    /**
     * Add global middleware
     */
    addGlobal(middleware: Middleware): void {
        this.globalMiddleware.push(middleware);
    }

    /**
     * Register named middleware
     */
    register(name: string, middleware: Middleware): void {
        this.namedMiddleware.set(name, middleware);
    }

    /**
     * Execute global middleware before phase
     */
    async executeGlobalBefore(request: Request): Promise<Response | null> {
        const context: MiddlewareContext = { request };

        for (const middleware of this.globalMiddleware) {
            if (middleware.before) {
                const result = await middleware.before(context);
                if (result) return result;
            }
        }
        return null;
    }

    /**
     * Execute global middleware after phase
     */
    async executeGlobalAfter(
        request: Request,
        response: Response,
    ): Promise<Response> {
        const context: MiddlewareContext = { request, response };
        let currentResponse = response;

        for (const middleware of this.globalMiddleware) {
            if (middleware.after) {
                context.response = currentResponse;
                currentResponse = await middleware.after(context);
            }
        }
        return currentResponse;
    }

    /**
     * Execute route-specific middleware before phase
     */
    async executeRouteBefore(
        request: Request,
        middlewareNames: string[],
    ): Promise<Response | null> {
        const context: MiddlewareContext = { request };

        for (const name of middlewareNames) {
            const middleware = this.namedMiddleware.get(name);
            if (!middleware) {
                throw new Error(`Middleware "${name}" not found`);
            }

            if (middleware.before) {
                const result = await middleware.before(context);
                if (result) return result;
            }
        }
        return null;
    }

    /**
     * Execute route-specific middleware after phase
     */
    async executeRouteAfter(
        request: Request,
        response: Response,
        middlewareNames: string[],
    ): Promise<Response> {
        const context: MiddlewareContext = { request, response };
        let currentResponse = response;

        for (const middleware of middlewareNames.map(
            (name) => this.namedMiddleware.get(name)!,
        )) {
            if (middleware.after) {
                context.response = currentResponse;
                currentResponse = await middleware.after(context);
            }
        }
        return currentResponse;
    }

    /**
     * Get a named middleware
     */
    get(name: string): Middleware | undefined {
        return this.namedMiddleware.get(name);
    }
}
