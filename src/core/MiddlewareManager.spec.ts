import { expect, describe, it, mock } from "bun:test";
import { MiddlewareManager } from "./MiddlewareManager";
import type { Middleware, MiddlewareContext } from "../types";

describe("MiddlewareManager", () => {
    it("should add and execute global middleware", async () => {
        const manager = new MiddlewareManager();
        const beforeSpy = mock(() => null);
        const afterSpy = mock((ctx: MiddlewareContext) => ctx.response as Response);

        const middleware: Middleware = {
            before: beforeSpy,
            after: afterSpy,
        };

        manager.addGlobal(middleware);

        const request = new Request("http://localhost");
        const response = new Response();

        await manager.executeGlobalBefore(request);
        await manager.executeGlobalAfter(request, response);

        expect(beforeSpy).toHaveBeenCalled();
        expect(afterSpy).toHaveBeenCalled();
    });

    it("should register and execute named middleware", async () => {
        const manager = new MiddlewareManager();
        const beforeSpy = mock(() => null);
        const afterSpy = mock((ctx: MiddlewareContext) => ctx.response as Response);

        const middleware: Middleware = {
            before: beforeSpy,
            after: afterSpy,
        };

        manager.register("test", middleware);

        const request = new Request("http://localhost");
        const response = new Response();

        await manager.executeRouteBefore(request, ["test"]);
        await manager.executeRouteAfter(request, response, ["test"]);

        expect(beforeSpy).toHaveBeenCalled();
        expect(afterSpy).toHaveBeenCalled();
    });

    it("should throw error for non-existent middleware", async () => {
        const manager = new MiddlewareManager();
        const request = new Request("http://localhost");

        await expect(
            manager.executeRouteBefore(request, ["nonexistent"])
        ).rejects.toThrow('Middleware "nonexistent" not found');
    });

    it("should stop execution when before middleware returns response", async () => {
        const manager = new MiddlewareManager();
        const response = new Response("Blocked", { status: 403 });

        const middleware1: Middleware = {
            before: mock(() => response),
            after: mock((ctx: MiddlewareContext) => ctx.response as Response),
        };

        const middleware2: Middleware = {
            before: mock(() => null),
            after: mock((ctx: MiddlewareContext) => ctx.response as Response),
        };

        manager.addGlobal(middleware1);
        manager.addGlobal(middleware2);

        const request = new Request("http://localhost");
        const result = await manager.executeGlobalBefore(request);

        expect(result).toBe(response);
        expect(middleware2.before).not.toHaveBeenCalled();
    });

    it("should chain multiple after middleware responses", async () => {
        const manager = new MiddlewareManager();

        const middleware1: Middleware = {
            after: mock((ctx: MiddlewareContext) => {
                return new Response("Modified 1");
            }),
        };

        const middleware2: Middleware = {
            after: mock((ctx: MiddlewareContext) => {
                return new Response("Modified 2");
            }),
        };

        manager.addGlobal(middleware1);
        manager.addGlobal(middleware2);

        const request = new Request("http://localhost");
        const initialResponse = new Response("Initial");
        const finalResponse = await manager.executeGlobalAfter(request, initialResponse);

        const text = await finalResponse.text();
        expect(text).toBe("Modified 2");
    });

    it("should handle middleware without before/after handlers", async () => {
        const manager = new MiddlewareManager();
        const middleware: Middleware = {};

        manager.addGlobal(middleware);
        manager.register("test", middleware);

        const request = new Request("http://localhost");
        const response = new Response();

        const beforeResult = await manager.executeGlobalBefore(request);
        expect(beforeResult).toBeNull();

        const afterResult = await manager.executeGlobalAfter(request, response);
        expect(afterResult).toBe(response);
    });

    it("should retrieve registered middleware", () => {
        const manager = new MiddlewareManager();
        const middleware: Middleware = {};

        manager.register("test", middleware);

        const retrieved = manager.get("test");
        expect(retrieved).toBe(middleware);

        const nonexistent = manager.get("nonexistent");
        expect(nonexistent).toBeUndefined();
    });

    it("should execute multiple named middleware in order", async () => {
        const manager = new MiddlewareManager();
        const order: number[] = [];

        const middleware1: Middleware = {
            before: mock(() => {
                order.push(1);
                return null;
            }),
        };

        const middleware2: Middleware = {
            before: mock(() => {
                order.push(2);
                return null;
            }),
        };

        manager.register("first", middleware1);
        manager.register("second", middleware2);

        const request = new Request("http://localhost");
        await manager.executeRouteBefore(request, ["first", "second"]);

        expect(order).toEqual([1, 2]);
    });
});
