import { expect, describe, it, beforeEach } from "bun:test";
import { Controller } from "./Controller";
import type { RequestContext, ValidationSchema } from "../types";

class TestController extends Controller {
    calledBefore = false;
    calledAfter = false;

    async handle(context: RequestContext): Promise<Response> {
        return this.success({ data: "test" });
    }

    protected override beforeHandle(): Promise<Response | null> {
        this.calledBefore = true;
        return Promise.resolve(null);
    }

    protected override afterHandle(response: Response): Promise<Response> {
        this.calledAfter = true;
        return Promise.resolve(response);
    }
}

class ShortCircuitController extends Controller {
    async handle(): Promise<Response> {
        return this.success({ data: "should not reach here" });
    }

    protected override beforeHandle(): Promise<Response> {
        return Promise.resolve(this.error("Short circuit", 403));
    }
}

class ValidationTestController extends Controller {
    schema: ValidationSchema = {
        name: { type: "string", required: true },
        age: { type: "number", required: true }
    };

    async handle(context: RequestContext): Promise<Response> {
        const validationResult = this.validateRequest(context, this.schema);
        if (validationResult) return validationResult;

        return this.success({ validated: true });
    }
}

describe("Controller", () => {
    let controller: TestController;
    let context: RequestContext;

    beforeEach(() => {
        controller = new TestController();
        context = {
            request: new Request("http://localhost"),
            params: {},
            query: {},
            body: {}
        };
    });

    it("should execute lifecycle hooks in order", async () => {
        const response = await controller.execute(context);
        const data = await response.json();

        expect(controller.calledBefore).toBe(true);
        expect(controller.calledAfter).toBe(true);
        expect(data).toEqual({
            success: true,
            data: { data: "test" }
        });
    });

    it("should allow short-circuiting in beforeHandle", async () => {
        const shortController = new ShortCircuitController();
        const response = await shortController.execute(context);
        const data = await response.json();

        expect(data).toEqual({
            success: false,
            message: "Short circuit"
        });
        expect(response.status).toBe(403);
    });

    it("should validate request data against schema", async () => {
        const validationController = new ValidationTestController();

        // Test invalid data
        const invalidContext: RequestContext = {
            ...context,
            body: { name: "Test" } // missing required age field
        };

        const invalidResponse = await validationController.execute(invalidContext);
        const invalidData = await invalidResponse.json();

        expect(invalidResponse.status).toBe(422);
        expect(invalidData.success).toBe(false);
        expect(invalidData.message).toBe("Validation failed");

        // Test valid data
        const validContext: RequestContext = {
            ...context,
            body: { name: "Test", age: 25 }
        };

        const validResponse = await validationController.execute(validContext);
        const validData = await validResponse.json();

        expect(validResponse.status).toBe(200);
        expect(validData.success).toBe(true);
        expect(validData.data.validated).toBe(true);
    });

    it("should set context properly", async () => {
        const testContext: RequestContext = {
            request: new Request("http://localhost/test?q=query"),
            params: { id: "123" },
            query: { q: "query" },
            body: { test: true }
        };

        await controller.execute(testContext);
        // @ts-expect-error: accessing protected property for testing
        expect(controller.context).toBe(testContext);
    });

    describe("Response Helpers", () => {
        it("should create JSON response", async () => {
            const data = { test: true };
            const response = controller.json(data, 201);

            expect(response.status).toBe(201);
            expect(response.headers.get("Content-Type")).toBe("application/json");
            expect(await response.json()).toEqual(data);
        });

        it("should create success response", async () => {
            const data = { test: true };
            const response = controller.success(data, "Success message");
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.message).toBe("Success message");
            expect(body.data).toEqual(data);
        });

        it("should create error response", async () => {
            const response = controller.error("Error message", 400, ["error1"]);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.success).toBe(false);
            expect(body.message).toBe("Error message");
            expect(body.errors).toEqual(["error1"]);
        });

        it("should create validation error response", async () => {
            const errors = [{ field: "name", message: "Required" }];
            const response = controller.validationError(errors);
            const body = await response.json();

            expect(response.status).toBe(422);
            expect(body.success).toBe(false);
            expect(body.message).toBe("Validation failed");
            expect(body.errors).toEqual(errors);
        });

        it("should create redirect response", () => {
            const response = controller.redirect("/new-location", 301);

            expect(response.status).toBe(301);
            expect(response.headers.get("Location")).toBe("/new-location");
        });

        it("should create text response", async () => {
            const response = controller.text("Hello World", 200);

            expect(response.status).toBe(200);
            expect(response.headers.get("Content-Type")).toBe("text/plain");
            expect(await response.text()).toBe("Hello World");
        });

        it("should create HTML response", async () => {
            const html = "<h1>Hello</h1>";
            const response = controller.html(html, 200);

            expect(response.status).toBe(200);
            expect(response.headers.get("Content-Type")).toBe("text/html");
            expect(await response.text()).toBe(html);
        });
    });

    describe("Logging Integration", () => {
        it("should create and cache logging integration instance", () => {
            const logger1 = controller.LoggingIntegration();
            const logger2 = controller.LoggingIntegration();

            expect(logger1).toBeDefined();
            expect(logger1).toBe(logger2); // Should return cached instance
        });
    });
});
