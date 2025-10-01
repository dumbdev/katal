import type { RequestContext, ValidationSchema } from "../types";
import { Validator } from "../validation";
import { LoggingIntegration } from "../logging";

export abstract class Controller {
    /**
     * The request context - available to all controller methods
     */
    protected context!: RequestContext;

    /**
     * Logging integration instance (lazy-loaded)
     */
    private _loggingIntegration?: LoggingIntegration;

    /**
     * Execute the controller - sets context and calls handle()
     * This method is called by the framework
     */
    async execute(context: RequestContext): Promise<any> {
        this.context = context;

        // Call beforeHandle hook if implemented
        if (this.beforeHandle) {
            const result = await this.beforeHandle();
            if (result) return result;
        }

        // Call the main handler
        const response = await this.handle(context);

        // Call afterHandle hook if implemented
        if (this.afterHandle) {
            return await this.afterHandle(response);
        }

        return response;
    }

    /**
     * Handle the request - must be implemented by subclasses
     */
    abstract handle(context: RequestContext): Promise<any> | any;

    /**
     * Hook called before handle() - override to add pre-processing
     * Return a Response to short-circuit the request
     */
    protected beforeHandle?(): Promise<Response | null> | Response | null;

    /**
     * Hook called after handle() - override to add post-processing
     */
    protected afterHandle?(response: any): Promise<any> | any;
    /**
     * Return a JSON response
     */
    protected json(data: any, status: number = 200): Response {
        return new Response(JSON.stringify(data), {
            status,
            headers: { "Content-Type": "application/json" },
        });
    }

    /**
     * Return a success response
     */
    protected success(data: any, message?: string): Response {
        return this.json({
            success: true,
            message,
            data,
        });
    }

    /**
     * Return an error response
     */
    protected error(
        message: string,
        status: number = 400,
        errors?: any,
    ): Response {
        return this.json(
            {
                success: false,
                message,
                errors,
            },
            status,
        );
    }

    /**
     * Return a validation error response
     */
    protected validationError(errors: any[]): Response {
        return this.error("Validation failed", 422, errors);
    }

    /**
     * Validate request data against a schema
     * Returns validation errors or null if valid
     */
    protected validateRequest(
        context: RequestContext,
        schema: ValidationSchema,
    ): Response | null {
        const { valid, errors } = Validator.validate(context.body, schema);

        if (!valid) {
            return this.validationError(errors);
        }

        return null;
    }

    /**
     * Return a redirect response
     */
    protected redirect(url: string, status: number = 302): Response {
        return new Response(null, {
            status,
            headers: { Location: url },
        });
    }

    /**
     * Return a text response
     */
    protected text(content: string, status: number = 200): Response {
        return new Response(content, {
            status,
            headers: { "Content-Type": "text/plain" },
        });
    }

    /**
     * Return an HTML response
     */
    protected html(content: string, status: number = 200): Response {
        return new Response(content, {
            status,
            headers: { "Content-Type": "text/html" },
        });
    }

    /**
     * Get or create a LoggingIntegration instance
     * Configure it with destinations like .toConsole() or .toFile()
     *
     * @example
     * const logger = this.LoggingIntegration().toConsole();
     * await logger.info("User logged in", { userId: 123 });
     *
     * @example
     * const logger = this.LoggingIntegration().toFile("app.log").toConsole();
     * await logger.error("Database error", error, { query: "SELECT ..." });
     */
    protected LoggingIntegration(): LoggingIntegration {
        if (!this._loggingIntegration) {
            this._loggingIntegration = new LoggingIntegration();
        }
        return this._loggingIntegration;
    }
}
