import type {
    RouteHandler,
    RouteDefinition,
    HttpMethod,
    ValidationSchema,
} from "../types";
import { MiddlewareManager } from "./MiddlewareManager.ts";
import type { Controller } from "../http";
import { Validator } from "../validation";

export interface RouteOptions {
    middleware?: string[];
    validation?: ValidationSchema;
}

export class Router {
    private routes: RouteDefinition[] = [];
    private prefix: string = '';
    private groupOptions?: RouteOptions;

    /**
     * Register a GET route with a controller
     */
    get(
        path: string,
        ControllerClass: new () => Controller,
        options?: RouteOptions,
    ): void {
        this.registerController("GET", path, ControllerClass, options);
    }

    /**
     * Register a POST route with a controller
     */
    post(
        path: string,
        ControllerClass: new () => Controller,
        options?: RouteOptions,
    ): void {
        this.registerController("POST", path, ControllerClass, options);
    }

    /**
     * Register a PUT route with a controller
     */
    put(
        path: string,
        ControllerClass: new () => Controller,
        options?: RouteOptions,
    ): void {
        this.registerController("PUT", path, ControllerClass, options);
    }

    /**
     * Register a PATCH route with a controller
     */
    patch(
        path: string,
        ControllerClass: new () => Controller,
        options?: RouteOptions,
    ): void {
        this.registerController("PATCH", path, ControllerClass, options);
    }

    /**
     * Register a DELETE route with a controller
     */
    delete(
        path: string,
        ControllerClass: new () => Controller,
        options?: RouteOptions,
    ): void {
        this.registerController("DELETE", path, ControllerClass, options);
    }

    /**
     * Group routes with a common prefix and options
     */
    group(prefix: string, callback: (router: Router) => void, options?: RouteOptions): void {
        const previousPrefix = this.prefix;
        const previousGroupOptions = this.groupOptions;
        const combinedPath = previousPrefix
            ? this.normalizePath(previousPrefix + "/" + prefix)
            : this.normalizePath(prefix);

        this.prefix = combinedPath;
        this.groupOptions = options;
        callback(this);
        this.prefix = previousPrefix;
        this.groupOptions = previousGroupOptions;
    }

    /**
     * Register a controller for a route
     */
    private registerController(
        method: HttpMethod,
        path: string,
        ControllerClass: new () => Controller,
        options?: RouteOptions,
    ): void {
        const fullPath = this.prefix
            ? this.normalizePath(this.prefix + "/" + path)
            : this.normalizePath(path);

        // Merge group options with route options
        const mergedOptions: RouteOptions = {
            ...(this.groupOptions ?? {}),
            ...(options ?? {}),
            middleware: [
                ...(this.groupOptions?.middleware ?? []),
                ...(options?.middleware ?? []),
            ],
            validation: options?.validation ?? this.groupOptions?.validation,
        };

        const handler: RouteHandler = async (context) => {
            // Validate if schema provided
            if (mergedOptions?.validation) {
                const { valid, errors } = Validator.validate(
                    context.body,
                    mergedOptions.validation,
                );
                if (!valid) {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            message: "Validation failed",
                            errors,
                        }),
                        {
                            status: 422,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }
            }

            // Create controller instance and execute
            const controller = new ControllerClass();
            return await controller.execute(context);
        };

        this.addRoute(method, fullPath, handler, mergedOptions.middleware ?? []);
    }

    /**
     * Register a route with any HTTP method
     */
    addRoute(
        method: HttpMethod,
        path: string,
        handler: RouteHandler,
        middleware: string[] = [],
    ): void {
        const normalizedPath = this.normalizePath(path);
        this.routes.push({
            method,
            path: normalizedPath,
            handler,
            middleware,
            pattern: this.pathToRegex(normalizedPath),
        });
    }

    /**
     * Handle an incoming request
     */
    async handle(
        request: Request,
        middlewareManager: MiddlewareManager,
    ): Promise<Response> {
        const url = new URL(request.url);
        const method = request.method as HttpMethod;
        const path = this.normalizePath(url.pathname);

        // Find matching route
        const route = this.findRoute(method, path);

        if (!route) {
            return new Response(JSON.stringify({ error: "Not Found", path }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Extract route parameters
        const params = this.extractParams(route, path);

        // Create request context
        const context = {
            request,
            params,
            query: Object.fromEntries(url.searchParams),
            body: await this.parseBody(request),
        };

        // Execute route middleware before phase
        const middlewareResult = await middlewareManager.executeRouteBefore(
            request,
            route.middleware,
        );
        if (middlewareResult) return middlewareResult;

        // Execute route handler
        const result = await route.handler(context);

        // Convert result to Response
        let response = this.toResponse(result);

        // Execute route middleware after phase
        response = await middlewareManager.executeRouteAfter(
            request,
            response,
            route.middleware,
        );

        return response;
    }

    /**
     * Find a matching route
     */
    private findRoute(
        method: HttpMethod,
        path: string,
    ): RouteDefinition | null {
        return (
            this.routes.find(
                (route) => route.method === method && route.pattern.test(path),
            ) ?? null
        );
    }

    /**
     * Extract route parameters
     */
    private extractParams(
        route: RouteDefinition,
        path: string,
    ): Record<string, string> {
        const match = path.match(route.pattern);
        if (!match) return {};

        const paramNames = this.getParamNames(route.path);
        const params: Record<string, string> = {};

        paramNames.forEach((name, index) => {
            params[name] = match[index + 1] ?? "";
        });

        return params;
    }

    /**
     * Get parameter names from path
     */
    private getParamNames(path: string): string[] {
        const matches = path.matchAll(/:(\w+)/g);
        return Array.from(matches, (m) => m[1] ?? "");
    }

    /**
     * Convert path to regex pattern
     */
    private pathToRegex(path: string): RegExp {
        const pattern = path
            .replace(/\//g, "\\/")
            .replace(/:(\w+)/g, "([^/]+)");
        return new RegExp(`^${pattern}$`);
    }

    /**
     * Normalize path
     */
    private normalizePath(path: string): string {
        // Handle root path
        if (path === "/") return "/";

        // Split path into segments and filter out empty ones
        const segments = path.split("/").filter(segment => segment.length > 0);

        // Join segments with single slashes and add leading slash
        return "/" + segments.join("/");
    }

    /**
     * Parse request body
     */
    private async parseBody(request: Request): Promise<any> {
        const contentType = request.headers.get("content-type");

        if (!contentType) return null;

        try {
            if (contentType.includes("application/json")) {
                return await request.json();
            } else if (
                contentType.includes("application/x-www-form-urlencoded")
            ) {
                const text = await request.text();
                return Object.fromEntries(new URLSearchParams(text));
            } else if (contentType.includes("multipart/form-data")) {
                const formData = await request.formData();
                const body: Record<string, any> = {};
                formData.forEach((value, key) => {
                    body[key] = value;
                });
                return body;
            }
        } catch (error) {
            console.error("Error parsing body:", error);
            return null;
        }

        return null;
    }

    /**
     * Convert handler result to Response
     */
    private toResponse(result: any): Response {
        if (result instanceof Response) {
            return result;
        }

        if (typeof result === "string") {
            return new Response(result, {
                headers: { "Content-Type": "text/plain" },
            });
        }

        return new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json" },
        });
    }

    /**
     * Get all registered routes
     */
    getRoutes(): RouteDefinition[] {
        return this.routes;
    }
}
