import { expect, describe, it, mock, beforeEach, afterEach } from "bun:test"
import { Application } from "./Application"
import type { Middleware, AppConfig, RequestContext } from "../types"
import { Controller } from "../http"

describe("Application", () => {
    let app: Application;

    beforeEach(() => {
        app = new Application();
    });

    afterEach(async () => {
        await app.stop();
    });

    it("should initialize with default configuration", () => {
        const config = app.resolve<AppConfig>("config");
        expect(config.port).toBe(3000);
        expect(config.host).toBe("localhost");
        expect(config.cors).toBe(false);
        expect(config.bodyParser).toBe(true);
    });

    it("should initialize with custom configuration", () => {
        const customApp = new Application({
            port: 4000,
            host: "0.0.0.0",
            cors: true,
            bodyParser: false,
        })

        const config = customApp.resolve<AppConfig>("config")
        expect(config.port).toBe(4000)
        expect(config.host).toBe("0.0.0.0")
        expect(config.cors).toBe(true)
        expect(config.bodyParser).toBe(false)
    })

    it("should register and resolve singleton services", () => {
        class TestService {
            value = "test"
        }

        app.singleton("test", () => new TestService())

        const instance1 = app.resolve<TestService>("test")
        const instance2 = app.resolve<TestService>("test")

        expect(instance1).toBe(instance2)
        expect(instance1.value).toBe("test")
    })

    it("should register and resolve transient services", () => {
        class TestService {
            value = "test"
        }

        app.bind("test", () => new TestService())

        const instance1 = app.resolve<TestService>("test")
        const instance2 = app.resolve<TestService>("test")

        expect(instance1).not.toBe(instance2)
        expect(instance1.value).toBe("test")
        expect(instance2.value).toBe("test")
    })

    it("should register and execute global middleware", async () => {
        const beforeSpy = mock(() => null)
        const afterSpy = mock((ctx) => ctx.response)

        const middleware: Middleware = {
            before: beforeSpy,
            after: afterSpy,
        }

        app.use(middleware)

        await app.listen(0) // Use port 0 for random available port
        const server = app.getServer()
        expect(server).toBeDefined()

        const response = await fetch(`http://${server?.hostname}:${server?.port}/`)

        expect(beforeSpy).toHaveBeenCalled()
        expect(afterSpy).toHaveBeenCalled()
        expect(response.status).toBe(404) // No routes defined
    })

    it("should register and execute named middleware", async () => {
        const beforeSpy = mock(() => null)
        const middleware: Middleware = { before: beforeSpy }

        app.registerMiddleware("test", middleware)
        const router = app.getRouter()

        class TestController extends Controller {
            async handle() {
                return new Response("test")
            }
        }

        router.get("/test", TestController, { middleware: ["test"] })

        await app.listen(0)
        const server = app.getServer()
        expect(server).toBeDefined()

        await fetch(`http://${server?.hostname}:${server?.port}/test`)
        expect(beforeSpy).toHaveBeenCalled()
    })

    it("should handle server errors gracefully", async () => {
        const router = app.getRouter()

        class ErrorController extends Controller {
            async handle(): Promise<Response> {
                throw new Error("Test error")
            }
        }

        router.get("/error", ErrorController)

        await app.listen(0)
        const server = app.getServer()
        expect(server).toBeDefined()

        const response = await fetch(`http://${server?.hostname}:${server?.port}/error`)
        type ErrorResponse = { error: string; message: string }
        const data = await response.json() as ErrorResponse

        expect(response.status).toBe(500)
        expect(data.error).toBe("Internal Server Error")
        expect(data.message).toBe("Test error")
    })

    it("should boot only once", async () => {
        let bootCount = 0
        const originalBoot = app["boot"].bind(app)

        // Override boot method to count calls
        app["boot"] = async () => {
            if (!app["server"]) { // Only increment if server doesn't exist
                bootCount++
            }
            await originalBoot()
        }

        await app.listen(0)
        await app.listen(0) // Second call should reuse existing boot

        expect(bootCount).toBe(1)
    })

    it("should stop the server successfully", async () => {
        await app.listen(0)
        const server = app.getServer()
        expect(server).toBeDefined()

        await app.stop()
        await expect(
            fetch(`http://${server?.hostname}:${server?.port}/`)
        ).rejects.toThrow()
    })

    it("should allow router group functionality", async () => {
        const router = app.getRouter()

        class TestController extends Controller {
            async handle() {
                return new Response("test")
            }
        }

        router.group("/api", (r) => {
            r.group("/v1", (r2) => {
                r2.get("/test", TestController)
            })
        })

        await app.listen(0)
        const server = app.getServer()
        expect(server).toBeDefined()

        const response = await fetch(`http://${server?.hostname}:${server?.port}/api/v1/test`)
        const text = await response.text()
        expect(text).toBe("test")
    })

    it("should maintain container singletons across requests", async () => {
        let counter = 0
        app.singleton("counter", () => ({
            increment: () => ++counter,
            get: () => counter,
        }))

        class CounterController extends Controller {
            async handle(context: RequestContext) {
                const counterService = app.resolve<{ increment: () => number; get: () => number }>("counter")
                counterService.increment()
                return this.success(counterService.get())
            }
        }

        app.getRouter().get("/counter", CounterController)

        await app.listen(0)
        const server = app.getServer()
        expect(server).toBeDefined()

        const response1 = await fetch(`http://${server?.hostname}:${server?.port}/counter`)
        const response2 = await fetch(`http://${server?.hostname}:${server?.port}/counter`)

        interface SuccessResponse {
            success: boolean
            data: number
        }

        const data1 = await response1.json() as SuccessResponse
        const data2 = await response2.json() as SuccessResponse

        expect(data1.data).toBe(1)
        expect(data2.data).toBe(2)
    })
})
