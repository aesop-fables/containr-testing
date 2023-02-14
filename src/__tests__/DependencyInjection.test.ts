import 'reflect-metadata';
import { BootstrappingServices, createContainer, IActivator, IServiceModule } from '../Bootstrapping';
import { ConfiguredDependency, inject, IServiceRegistry, ServiceCollection } from '../Container';
import { mock } from 'jest-mock-extended';
import { Disposable } from '../Disposable';

class UsingExpression<T extends Disposable> {
  constructor(private factory: () => T) {}

  do(action: (value: T) => void): void {
    const value = this.factory();
    try {
      action(value);
    } finally {
      value.dispose();
    }
  }
}

function using<T extends Disposable>(factory: () => T): UsingExpression<T> {
  return new UsingExpression(factory);
}

interface ISampleService {
  instanceId: string;
  invoke(): void;
}

let nrInstantiations = 0;
class SampleService implements ISampleService {
  constructor(private id: string) {
    ++nrInstantiations;
  }

  get instanceId(): string {
    return this.id;
  }

  public invoke(): void {
    console.log('Invoked!');
  }
}

describe('Dependency Injection', () => {
  beforeEach(() => {
    nrInstantiations = 0;
  });

  describe('ConfiguredDependency', () => {
    test('isResolved() - true', () => {
      const key = 'test';
      const dependency = new ConfiguredDependency<string>(key, 'foo');
      expect(dependency.isResolved()).toBeTruthy();
    });

    test('isResolved() - ƒalse', () => {
      const key = 'test';
      const dependency = new ConfiguredDependency<string | undefined>(key, () => undefined);
      expect(dependency.isResolved()).toBeFalsy();
    });

    test('resolveValue() - happy path', () => {
      const key = 'test';
      const dependency = new ConfiguredDependency<string>(key, () => 'foo');
      const container = new ServiceCollection().buildContainer();
      expect(dependency.resolveValue(container)).toBe('foo');
    });

    test('resolveValue() - uses factory when value is undefined', () => {
      const key = 'test';
      let invoked = false;
      const dependency = new ConfiguredDependency<string>(key, () => {
        invoked = true;
        return 'foo';
      });
      const container = new ServiceCollection().buildContainer();
      expect(dependency.resolveValue(container)).toBe('foo');
      expect(invoked).toBeTruthy();
    });

    test('resolveValue() - uses factory and caches value', () => {
      const key = 'test';
      let nrInvocations = 0;
      const dependency = new ConfiguredDependency<string>(key, () => {
        ++nrInvocations;
        return 'foo';
      });
      const container = new ServiceCollection().buildContainer();
      expect(dependency.resolveValue(container)).toBe('foo');
      expect(dependency.resolveValue(container)).toBe('foo');
      expect(nrInvocations).toBe(1);
    });

    test('replaceValue() - uses value provided', () => {
      const key = 'test';
      let invoked = false;
      const dependency = new ConfiguredDependency<string>(key, () => {
        // invoked = true; leaving this commented out for the visual cue
        return 'foo';
      });
      dependency.replaceValue(() => {
        invoked = true;
        return 'foo';
      });
      const container = new ServiceCollection().buildContainer();
      expect(dependency.resolveValue(container)).toBe('foo');
      expect(invoked).toBeTruthy();
    });

    test('replaceValue() - uses factory provided and caches result', () => {
      const key = 'test';
      let nrInvocations = 0;
      const dependency = new ConfiguredDependency<string>(key, () => {
        throw new Error('NOPE NOPE NOPE');
      });
      dependency.replaceValue(() => {
        ++nrInvocations;
        return 'foo';
      });
      const container = new ServiceCollection().buildContainer();
      expect(dependency.resolveValue(container)).toBe('foo');
      expect(dependency.resolveValue(container)).toBe('foo');
      expect(nrInvocations).toBe(1);
    });
  });

  describe('ServiceCollection', () => {
    // the rest of the mechanics have an integration tests
    // since we use the collection to build up the container in each test
    test('Importing services with no collisions', () => {
      const key1 = '132412341234';
      const key2 = '002892827878';
      const value1 = 'test1@test.com';
      const value2 = 'test2@test.com';

      const services1 = new ServiceCollection();
      const services2 = new ServiceCollection();
      services1.register(key1, value1);
      services2.register(key2, value2);

      services1.import(services2);

      const container = services1.buildContainer();
      expect(container.get<string>(key2)).toBe(value2);
    });

    test('Importing services with collisions', () => {
      const key1 = '132412341234';
      const key2 = '002892827878';
      const value1 = 'test1@test.com';
      const value2 = 'test2@test.com';
      const value3 = 'test3@test.com';

      const services1 = new ServiceCollection();
      const services2 = new ServiceCollection();
      services1.register(key1, value1);
      services2.register(key2, value2);
      services2.register(key1, value3);

      services1.import(services2);

      const container = services1.buildContainer();

      // Make sure that the imported key wins
      expect(container.get<string>(key1)).toBe(value3);
    });

    test('Importing services with collisions via a registry', () => {
      const key1 = '132412341234';
      const key2 = '002892827878';
      const value1 = 'test1@test.com';
      const value2 = 'test2@test.com';
      const value3 = 'test3@test.com';

      class SampleRegistry implements IServiceRegistry {
        configureServices(services: ServiceCollection): void {
          services.register(key2, value2);
          services.register(key1, value3);
        }
      }

      const services = new ServiceCollection();
      services.register(key1, value1);
      services.include(new SampleRegistry());

      const container = services.buildContainer();

      // Make sure that the imported key wins
      expect(container.get<string>(key1)).toBe(value3);
    });

    test('Import a registry', () => {
      const key1 = '132412341234';
      const key2 = '002892827878';
      const value1 = 'test1@test.com';
      const value2 = 'test2@test.com';

      class SampleRegistry implements IServiceRegistry {
        configureServices(services: ServiceCollection): void {
          services.register(key1, value1);
          services.register(key2, value2);
        }
      }

      const services = new ServiceCollection();
      services.importRegistry(SampleRegistry);

      const container = services.buildContainer();

      expect(container.get<string>(key1)).toBe(value1);
      expect(container.get<string>(key2)).toBe(value2);
    });

    test('add multiple implementations', () => {
      interface IPolicy {
        getOperand(): number;
      }

      class PolicyA implements IPolicy {
        getOperand(): number {
          return 1;
        }
      }

      class PolicyB implements IPolicy {
        getOperand(): number {
          return 9;
        }
      }

      const key = 'policies';
      const services = new ServiceCollection();
      services.add<IPolicy>(key, PolicyA);
      services.add<IPolicy>(key, PolicyB);

      const container = services.buildContainer();
      const policies = container.get<IPolicy[]>(key);

      const sum = policies.map((p) => p.getOperand()).reduce((a, b) => a + b, 0);
      expect(sum).toBe(10);
    });
  });

  describe('ServiceContainer', () => {
    test('Register and resolve a singleton value', async () => {
      const testServiceKey = '132412341234';
      const value = 'test@test.com';

      const services = new ServiceCollection();
      services.register(testServiceKey, value);

      const container = services.buildContainer();

      expect(container.get<string>(testServiceKey)).toBe(value);
    });

    test('Register and resolve multiple values', async () => {
      const key1 = '132412341234';
      const key2 = '002892827878';
      const value1 = 'test1@test.com';
      const value2 = 'test2@test.com';

      const services = new ServiceCollection();
      services.register(key1, value1);
      services.register(key2, value2);

      const container = services.buildContainer();

      expect(container.get<string, string>([key1, key2])).toStrictEqual([value1, value2]);
    });

    test('Register and resolve a lazy value', async () => {
      const testServiceKey = 'sample';

      const id = '1234';
      const services = new ServiceCollection();
      services.register<ISampleService>(testServiceKey, () => new SampleService(id));

      const container = services.buildContainer();

      expect(container.get<ISampleService>(testServiceKey).instanceId).toBe(id);
    });

    test('Resolving values only instantiates them once', async () => {
      const testServiceKey = 'sample';

      const id = '1234';
      const services = new ServiceCollection();
      services.register<ISampleService>(testServiceKey, () => new SampleService(id));

      const container = services.buildContainer();

      for (let i = 0; i < 5; i++) {
        container.get<ISampleService>(testServiceKey);
      }

      expect(nrInstantiations).toBe(1);
    });

    test('Disposing the container resets the instances', async () => {
      const testServiceKey = 'sample';

      const id = '1234';
      const services = new ServiceCollection();
      services.register<ISampleService>(testServiceKey, () => new SampleService(id));

      const container = services.buildContainer();
      for (let i = 0; i < 5; i++) {
        // This will only instantiate the instance ONCE
        container.get<ISampleService>(testServiceKey);
      }

      container.dispose();

      // Force another instantiation
      container.get<ISampleService>(testServiceKey);

      expect(nrInstantiations).toBe(2);
    });

    test('Resolving an unknown service throws an error', async () => {
      const container = new ServiceCollection().buildContainer();
      expect(() => container.get<ISampleService>('unknown')).toThrowError();
    });

    describe('Child Containers', () => {
      test('Resolving a value in the parent container persists the value into a child container', async () => {
        const testServiceKey = 'sample';
        const id = '1234';
        const services = new ServiceCollection();
        services.register<ISampleService>(testServiceKey, () => new SampleService(id));

        const container = services.buildContainer();
        container.get<ISampleService>(testServiceKey);

        using(() => container.createChildContainer('test')).do((childContainer) => {
          childContainer.get<ISampleService>(testServiceKey);
        });

        expect(nrInstantiations).toBe(1);
      });

      test('Resolving a value in the child container does not leak into the parent container', async () => {
        const testServiceKey = 'sample';
        const id = '1234';
        const services = new ServiceCollection();
        services.register<ISampleService>(testServiceKey, () => new SampleService(id));

        const container = services.buildContainer();
        using(() => container.createChildContainer('test')).do((childContainer) => {
          childContainer.get<ISampleService>(testServiceKey);
        });

        container.get<ISampleService>(testServiceKey);
        expect(nrInstantiations).toBe(2);
      });
    });
  });
});

describe('Auto-wiring', () => {
  test('Happy path', () => {
    interface IService {
      execute(): void;
    }

    interface IDependency {
      execute(): void;
    }

    class Dependency implements IDependency {
      public executed = false;

      execute() {
        console.log('Executing');
        this.executed = true;
      }
    }

    class Service implements IService {
      constructor(@inject('Hello') private readonly dependency: IDependency) {}

      execute(): void {
        this.dependency.execute();
      }
    }

    const dependency = new Dependency();
    const services = new ServiceCollection();
    services.register<IDependency>('Hello', () => dependency);
    services.use('Service', Service);

    const container = services.buildContainer();
    const service = container.get<IService>('Service');

    service.execute();

    expect(dependency.executed).toBeTruthy();
  });

  test('resolve more than once', () => {
    function bootstrapAndRunActivators() {
      const policyA = mock<IPolicy>();
      const policyB = mock<IPolicy>();
      const service = mock<IService>();

      class TestModule implements IServiceModule {
        get name(): string {
          return 'test';
        }

        configureServices(services: ServiceCollection): void {
          services.addDependency<IPolicy>('two', policyA);
          services.addDependency<IPolicy>('two', policyB);
          services.register<IService>('one', () => service);
          services.add<IActivator>(BootstrappingServices.Activators, StubActivator);
        }
      }

      createContainer([new TestModule()], { runActivators: true });
      expect(policyA.execute).toHaveBeenCalled();
      expect(policyB.execute).toHaveBeenCalled();
      expect(service.execute).toHaveBeenCalled();
    }

    bootstrapAndRunActivators();
    bootstrapAndRunActivators();
  });

  test('resolve concrete newable', () => {
    const policyA = mock<IPolicy>();
    const policyB = mock<IPolicy>();
    const service = mock<IService>();

    const services = new ServiceCollection();
    services.addDependency<IPolicy>('two', policyA);
    services.addDependency<IPolicy>('two', policyB);
    services.register<IService>('one', service);

    const container = services.buildContainer();
    const activator = container.resolve(StubActivator);
    activator.activate();

    expect(policyA.execute).toHaveBeenCalled();
    expect(policyB.execute).toHaveBeenCalled();
    expect(service.execute).toHaveBeenCalled();
  });
});

interface IPolicy {
  execute(): void;
}

interface IService {
  execute(): void;
}

class StubActivator implements IActivator {
  constructor(@inject('one') private readonly service: IService, @inject('two') private readonly policies: IPolicy[]) {}

  activate(): void {
    this.service.execute();
    this.policies.forEach((x) => x.execute());
  }
}
