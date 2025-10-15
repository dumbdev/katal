import { expect, describe, it, mock } from "bun:test";
import { Router } from "./Router";
import { Controller } from "../http";
import  type { RequestContext } from "../types";

class TestController extends Controller {
    async handle(context: RequestContext) {
        return this.success({ message: "test" });
    }
}

class TestAuthController extends Controller {
    async handle(context: RequestContext) {
        return this.success({ message: "auth" });
    }
}

describe("Router", () => {
    it("should register routes correctly", () => {
        const router = new Router();
        router.get("/test", TestController);
        router.post("/test", TestController);

        const routes = router.getRoutes();
        expect(routes).toHaveLength(2);
        expect(routes[0]!.method).toBe("GET");
        expect(routes[0]!.path).toBe("/test");
        expect(routes[1]!.method).toBe("POST");
        expect(routes[1]!.path).toBe("/test");
    });

    it("should handle route groups correctly", () => {
        const router = new Router();

        router.group("/api", (r) => {
            r.get("/test", TestController);

            r.group("/v1", (r2) => {
                r2.post("/auth", TestAuthController);
            });
        });

        const routes = router.getRoutes();
        expect(routes).toHaveLength(2);
        expect(routes[0]!.path).toBe("/api/test");
        expect(routes[1]!.path).toBe("/api/v1/auth");
    });

    it("should handle request parameters correctly", async () => {
        const router = new Router();
        router.get("/users/:id", TestController);

        const request = new Request("http://localhost/users/123");
        const response = await router.handle(request, {
            executeRouteBefore: mock(() => null),
            executeRouteAfter: mock((req, res) => res),
        } as any);

        const data = await response.json();
        expect(data).toEqual({ data: { message: "test" },success: true });
    });

    it("should handle validation correctly", async () => {
        const router = new Router();
        router.post("/users", TestController, {
            validation: {
                name: { type: "string", required: true },
                age: { type: "number", required: true },
            },
        });

        const request = new Request("http://localhost/users", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ name: "John" }), // missing required age field
        });

        const response = await router.handle(request, {
            executeRouteBefore: mock(() => null),
            executeRouteAfter: mock((req, res) => res),
        } as any);

        expect(response.status).toBe(422);
        const data = await response.json() as { success: boolean; message: string };
        expect(data.success).toBe(false);
        expect(data.message).toBe("Validation failed");
    });

    it("should handle middleware correctly", async () => {
        const router = new Router();
        router.get("/protected", TestController, {
            middleware: ["auth"],
        });

        const request = new Request("http://localhost/protected");
        const middlewareManager = {
            executeRouteBefore: mock(() => new Response(null, { status: 401 })),
            executeRouteAfter: mock((req, res) => res),
        };

        const response = await router.handle(request, middlewareManager as any);
        expect(response.status).toBe(401);
    });

    it("should handle 404 not found", async () => {
        const router = new Router();
        router.get("/test", TestController);

        const request = new Request("http://localhost/nonexistent");
        const response = await router.handle(request, {
            executeRouteBefore: mock(() => null),
            executeRouteAfter: mock((req, res) => res),
        } as any);

        expect(response.status).toBe(404);
        const data = await response.json() as { error: string };
        expect(data.error).toBe("Not Found");
    });

    it("should handle different HTTP methods", () => {
        const router = new Router();
        router.get("/test", TestController);
        router.post("/test", TestController);
        router.put("/test", TestController);
        router.patch("/test", TestController);
        router.delete("/test", TestController);

        const routes = router.getRoutes();
        expect(routes).toHaveLength(5);
        expect(routes.map(r => r.method)).toEqual([
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE"
        ]);
    });

    it("should handle request body parsing", async () => {
        const router = new Router();
        router.post("/test", TestController);

        const request = new Request("http://localhost/test", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ test: "data" }),
        });

        const response = await router.handle(request, {
            executeRouteBefore: mock(() => null),
            executeRouteAfter: mock((req, res) => res),
        } as any);

        expect(response.status).toBe(200);
    });

    it("should normalize paths correctly", () => {
        const router = new Router();
        router.get(`/test`, TestController);
        router.post("test", TestController);

        const routes = router.getRoutes();
        expect(routes[0]!.path).toBe("/test");
        expect(routes[1]!.path).toBe("/test");
    });

    it("should handle nested route groups correctly", () => {
        const router = new Router();

        router.group("/api", (r) => {
            r.get("/users", TestController);

            r.group("/v1", (r2) => {
                r2.get("/products", TestController);

                r2.group("/admin", (r3) => {
                    r3.post("/settings", TestAuthController);
                });
            });
        });

        const routes = router.getRoutes();
        expect(routes).toHaveLength(3);
        expect(routes[0]!.path).toBe("/api/users");
        expect(routes[1]!.path).toBe("/api/v1/products");
        expect(routes[2]!.path).toBe("/api/v1/admin/settings");
    });

    it("should handle multiple route groups at the same level", () => {
        const router = new Router();

        router.group("/api", (r) => {
            r.get("/users", TestController);
        });

        router.group("/admin", (r) => {
            r.post("/settings", TestAuthController);
        });

        const routes = router.getRoutes();
        expect(routes).toHaveLength(2);
        expect(routes[0]!.path).toBe("/api/users");
        expect(routes[1]!.path).toBe("/admin/settings");
    });

    it("should handle route groups with trailing slashes", () => {
        const router = new Router();

        router.group("/api/", (r) => {
            r.get("users/", TestController);

            r.group("v1/", (r2) => {
                r2.get("/auth/", TestAuthController);
            });
        });

        const routes = router.getRoutes();
        expect(routes).toHaveLength(2);
        expect(routes[0]!.path).toBe("/api/users");
        expect(routes[1]!.path).toBe("/api/v1/auth");
    });

    it("should preserve route options within groups", () => {
        const router = new Router();

        router.group("/api", (r) => {
            r.post("/users", TestController, {
                middleware: ["auth"],
                validation: {
                    name: { type: "string", required: true }
                }
            });
        });

        const routes = router.getRoutes();
        expect(routes).toHaveLength(1);
        expect(routes[0]!.path).toBe("/api/users");
        expect(routes[0]!.middleware).toEqual(["auth"]);
    });

    it("should apply group options to all routes in the group", () => {
        const router = new Router();
        const groupValidation = { name: { type: "string" as const, required: true } };
        router.group("/api", (r) => {
            r.post("/users", TestController); // should inherit group options
            r.post("/admins", TestController, {
                middleware: ["admin"], // should merge with group middleware
                validation: { role: { type: "string", required: true } }, // should override group validation
            });
        }, {
            middleware: ["auth"],
            validation: groupValidation,
        });

        const routes = router.getRoutes();
        expect(routes).toHaveLength(2);
        // First route should inherit group middleware and validation
        expect(routes[0]!.middleware).toEqual(["auth"]);
        expect(routes[0]!.path).toBe("/api/users");
        expect(routes[0]!.handler).toBeDefined();
        // Second route should merge middleware and override validation
        expect(routes[1]!.middleware).toEqual(["auth", "admin"]);
        expect(routes[1]!.path).toBe("/api/admins");
        expect(routes[1]!.handler).toBeDefined();
    });
});
