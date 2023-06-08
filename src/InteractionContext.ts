import { MockProxy, mock } from 'jest-mock-extended';
import { Internals, Newable, IServiceContainer, ServiceCollection } from '@aesop-fables/containr';

export class Lazy<T> {
  private _value: T | undefined;
  constructor(private readonly factory: () => T) {}
  get isValueCreated(): boolean {
    return typeof this._value !== 'undefined';
  }

  get value(): T {
    if (!this.isValueCreated) {
      this._value = this.factory();
    }

    return this._value as T;
  }

  reset(): void {
    this._value = undefined;
  }
}

export class InteractionContext<ClassUnderTest> {
  readonly _container: Lazy<IServiceContainer>;
  readonly _classUnderTest: Lazy<ClassUnderTest>;
  constructor(private readonly _services: ServiceCollection, constructor: Newable<ClassUnderTest>) {
    this._container = new Lazy(() => this.services.buildContainer());
    this._classUnderTest = new Lazy(() => this.container.resolve(constructor));
  }

  get services(): ServiceCollection {
    this._container.reset();
    this._classUnderTest.reset();
    return this._services;
  }

  get container(): IServiceContainer {
    return this._container.value;
  }

  get classUnderTest(): ClassUnderTest {
    return this._classUnderTest.value;
  }

  mockFor<T>(key: string): MockProxy<T> {
    return this.container.get<MockProxy<T>>(key);
  }
}

export function createInteractionContext<T>(constructor: Newable<T>): InteractionContext<T> {
  const metadata = Internals.getDependencyMetadata(constructor);
  const services = new ServiceCollection();

  metadata.forEach(({ dependencyKey }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    services.singleton(dependencyKey, mock<any>(undefined, { deep: true }));
  });

  return new InteractionContext(services, constructor);
}
