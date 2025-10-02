export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestContext {
    request: Request;
    params: Record<string, string>;
    query: Record<string, string>;
    body: any;
}

export type RouteHandler = (context: RequestContext) => Promise<any> | any;

export interface RouteDefinition {
    method: HttpMethod;
    path: string;
    handler: RouteHandler;
    middleware: string[];
    pattern: RegExp;
}

export interface MiddlewareContext {
    request: Request;
    response?: Response;
}

export interface Middleware {
    /**
     * Called before the controller executes
     * Return a Response to short-circuit the request
     */
    before?(
        context: MiddlewareContext,
    ): Promise<Response | null> | Response | null;

    /**
     * Called after the controller executes
     * Can modify or replace the response
     */
    after?(context: MiddlewareContext): Promise<Response> | Response;
}

export interface AppConfig {
    port: number;
    host: string;
    cors: boolean;
    bodyParser: boolean;
}

export interface ValidationRule {
    required?: boolean;
    type?:
        | "string"
        | "number"
        | "boolean"
        | "email"
        | "url"
        | "array"
        | "object";
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    custom?: (value: any) => boolean | string;
    enum?: any[];
    schema?: ValidationSchema;
}

export interface ValidationSchema {
    [key: string]: ValidationRule;
}

export interface ValidationError {
    field: string;
    message: string;
}

export interface User {
    id: string | number;
    [key: string]: any;
}

export interface AuthConfig {
    secret: string;
    expiresIn?: string;
    algorithm?: string;
}
