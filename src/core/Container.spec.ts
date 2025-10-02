import { expect, describe, it, mock } from "bun:test";
import { Container } from "./Container";

class TestService {
    value: string = "test";
}

class DependentService {
    constructor(private testService: TestService) {}
    getValue() {
        return this.testService.value;
    }
}

describe("Container", () => {
    it("should register and resolve singleton bindings", () => {
        const container = new Container();
        container.singleton("test", () => new TestService());

        const instance1 = container.resolve<TestService>("test");
        const instance2 = container.resolve<TestService>("test");

        expect(instance1).toBe(instance2);
        expect(instance1.value).toBe("test");
    });

    it("should register and resolve transient bindings", () => {
        const container = new Container();
        container.bind("test", () => new TestService());

        const instance1 = container.resolve<TestService>("test");
        const instance2 = container.resolve<TestService>("test");

        expect(instance1).not.toBe(instance2);
        expect(instance1.value).toBe("test");
        expect(instance2.value).toBe("test");
    });

    it("should throw error when resolving non-existent binding", () => {
        const container = new Container();

        expect(() => {
            container.resolve("nonexistent");
        }).toThrow('Service "nonexistent" not found in container');
    });

    it("should check if binding exists", () => {
        const container = new Container();
        container.bind("test", () => new TestService());

        expect(container.has("test")).toBe(true);
        expect(container.has("nonexistent")).toBe(false);
    });

    it("should remove bindings", () => {
        const container = new Container();
        container.bind("test", () => new TestService());

        expect(container.has("test")).toBe(true);
        container.forget("test");
        expect(container.has("test")).toBe(false);
    });

    it("should maintain separate instances for different bindings", () => {
        const container = new Container();
        container.singleton("test1", () => new TestService());
        container.singleton("test2", () => new TestService());

        const instance1 = container.resolve<TestService>("test1");
        const instance2 = container.resolve<TestService>("test2");

        expect(instance1).not.toBe(instance2);
    });

    it("should support factory functions that use other dependencies", () => {
        const container = new Container();

        container.singleton("testService", () => new TestService());
        container.singleton("dependent", () => {
            const testService = container.resolve<TestService>("testService");
            return new DependentService(testService);
        });

        const dependent = container.resolve<DependentService>("dependent");
        expect(dependent.getValue()).toBe("test");
    });

    it("should allow replacing bindings", () => {
        const container = new Container();

        container.singleton("test", () => new TestService());
        const original = container.resolve<TestService>("test");

        container.singleton("test", () => {
            const service = new TestService();
            service.value = "modified";
            return service;
        });

        const modified = container.resolve<TestService>("test");
        expect(modified.value).toBe("modified");
        expect(modified).not.toBe(original);
    });

    it("should maintain singleton state across resolves", () => {
        const container = new Container();
        let count = 0;

        container.singleton("counter", () => {
            count++;
            return { count };
        });

        container.resolve("counter");
        container.resolve("counter");
        container.resolve("counter");

        expect(count).toBe(1);
    });

    it("should execute factory function each time for transient bindings", () => {
        const container = new Container();
        let count = 0;

        container.bind("counter", () => {
            count++;
            return { count };
        });

        container.resolve("counter");
        container.resolve("counter");
        container.resolve("counter");

        expect(count).toBe(3);
    });

    it("should support complex dependency chains", () => {
        const container = new Container();

        class ServiceA {
            value = "A";
        }

        class ServiceB {
            constructor(public a: ServiceA) {}
            getValue() {
                return this.a.value + "B";
            }
        }

        class ServiceC {
            constructor(public b: ServiceB) {}
            getValue() {
                return this.b.getValue() + "C";
            }
        }

        container.singleton("serviceA", () => new ServiceA());
        container.singleton("serviceB", () => {
            const a = container.resolve<ServiceA>("serviceA");
            return new ServiceB(a);
        });
        container.singleton("serviceC", () => {
            const b = container.resolve<ServiceB>("serviceB");
            return new ServiceC(b);
        });

        const serviceC = container.resolve<ServiceC>("serviceC");
        expect(serviceC.getValue()).toBe("ABC");
    });
});
