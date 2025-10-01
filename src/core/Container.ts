type Factory<T> = () => T;

interface Binding<T> {
    factory: Factory<T>;
    singleton: boolean;
    instance?: T;
}

export class Container {
    private bindings = new Map<string, Binding<any>>();

    /**
     * Register a singleton binding
     */
    singleton<T>(name: string, factory: Factory<T>): void {
        this.bindings.set(name, {
            factory,
            singleton: true,
        });
    }

    /**
     * Register a transient binding
     */
    bind<T>(name: string, factory: Factory<T>): void {
        this.bindings.set(name, {
            factory,
            singleton: false,
        });
    }

    /**
     * Resolve a binding from the container
     */
    resolve<T>(name: string): T {
        const binding = this.bindings.get(name);

        if (!binding) {
            throw new Error(`Service "${name}" not found in container`);
        }

        if (binding.singleton) {
            if (!binding.instance) {
                binding.instance = binding.factory();
            }
            return binding.instance;
        }

        return binding.factory();
    }

    /**
     * Check if a binding exists
     */
    has(name: string): boolean {
        return this.bindings.has(name);
    }

    /**
     * Remove a binding
     */
    forget(name: string): void {
        this.bindings.delete(name);
    }
}
