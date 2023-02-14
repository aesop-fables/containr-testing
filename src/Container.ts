import { Disposable } from './Disposable';
import { Stack } from './Stack';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type ValueFactoryDelegate<T> = (provider: IServiceContainer) => T;

export interface IConfiguredDependency<T> {
  key: string;
  isResolved(): boolean;
  resolveValue(container: IServiceContainer): T;
  clone(): IConfiguredDependency<T>;
}

export class ConfiguredDependency<T> implements IConfiguredDependency<T> {
  readonly key: string;
  factory: ValueFactoryDelegate<T>;
  value: T | undefined;

  constructor(key: string, value: T | ValueFactoryDelegate<T>) {
    this.key = key;

    if (typeof value === 'function') {
      this.factory = value as ValueFactoryDelegate<T>;
    } else {
      this.factory = () => value;
      this.value = value;
    }
  }

  isResolved(): boolean {
    return typeof this.value !== 'undefined';
  }

  resolveValue(container: IServiceContainer): T {
    if (typeof this.value === 'undefined') {
      this.value = this.factory(container);
    }

    return this.value;
  }

  // for the upcoming "inject"/configure on the container
  replaceValue(value: T | ValueFactoryDelegate<T>): void {
    if (typeof value === 'function') {
      this.factory = value as ValueFactoryDelegate<T>;
    } else {
      this.factory = () => value;
      this.value = value;
    }
  }

  clone(): IConfiguredDependency<T> {
    return new ConfiguredDependency(this.key, this.factory);
  }
}

export class ArrayDependency<T> implements IConfiguredDependency<T[]> {
  private resolved = false;

  constructor(readonly key: string, private readonly values: IConfiguredDependency<T>[] = []) {}

  isResolved(): boolean {
    return this.resolved;
  }

  resolveValue(container: IServiceContainer): T[] {
    this.resolved = true;
    return this.values.map((x) => x.resolveValue(container));
  }

  register(value: T | ValueFactoryDelegate<T>): void {
    this.values.push(new ConfiguredDependency(`${this.key}-${this.values.length}`, value));
  }

  push(clazz: Newable<T>): void {
    this.values.push(new ConfiguredDependency(`${this.key}-${this.values.length}`, createAutoWireFactory<T>(clazz)));
  }

  clone(): IConfiguredDependency<T[]> {
    return new ArrayDependency<T>(this.key, this.values);
  }
}

const injectMetadataKey = Symbol('@aesop-fables/containr/inject');

// eslint-disable-next-line @typescript-eslint/ban-types
export const getDependencyMetadata = (constructor: Object) => {
  const metadata = (Reflect.getMetadata(injectMetadataKey, constructor) || []) as IDependencyMetadata[];
  return metadata;
};

export type Newable<T> = new (...args: any[]) => T;

interface IDependencyMetadata {
  dependencyKey: string;
  parameterIndex: number;
  propertyKey: string | symbol | undefined;
}

export function inject(dependencyKey: string) {
  // eslint-disable-next-line @typescript-eslint/ban-types
  return (target: Object, propertyKey: string | symbol, parameterIndex: number): void => {
    const params = getDependencyMetadata(target);
    params.push({ dependencyKey, parameterIndex, propertyKey } as IDependencyMetadata);

    Reflect.defineMetadata(injectMetadataKey, params, target);
  };
}

export function createAutoWireFactory<T>(constructor: Newable<T>): ValueFactoryDelegate<T> {
  return (container: IServiceContainer) => {
    const metadata = getDependencyMetadata(constructor);
    if (!metadata || metadata.length === 0) {
      return new constructor();
    }

    // These are coming in descending order
    const paramTypes: IDependencyMetadata[] = [...metadata];
    paramTypes.reverse();
    const params = paramTypes.map((metadata: IDependencyMetadata) => container.get(metadata.dependencyKey));
    return new constructor(...params);
  };
}

export interface IServiceContainer extends Disposable {
  /**
   * Retrieves/constructs the specified dependencies
   * @param key The service(s) to retrieve
   */
  get<T>(key: string): T;
  get<T1, T2>(keys: string[]): [T1, T2];
  get<T1, T2, T3>(keys: string[]): [T1, T2, T3];
  get<T1, T2, T3, T4>(keys: string[]): [T1, T2, T3, T4];
  get<T1, T2, T3, T4, T5>(keys: string[]): [T1, T2, T3, T4, T5];
  get<T1, T2, T3, T4, T5, T6>(keys: string[]): [T1, T2, T3, T4, T5, T6];
  get<T1, T2, T3, T4, T5, T6, T7>(keys: string[]): [T1, T2, T3, T4, T5, T6, T7];
  get<T1, T2, T3, T4, T5, T6, T7, T8>(keys: string[]): [T1, T2, T3, T4, T5, T6, T7, T8];
  get<T1, T2, T3, T4, T5, T6, T7, T8, T9>(keys: string[]): [T1, T2, T3, T4, T5, T6, T7, T8, T9];
  get<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(keys: string[]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10];

  /**
   * Creates a container by copying 1)the current configuration and 2) the previously resolved instances.
   * @param provenance Moniker for the child container
   */
  createChildContainer(provenance: string): IServiceContainer;
  /**
   * Instantiates the specified class by resolving any dependencies found in the constuctor (using the @inject decorator).
   * @param clazz The class to instantiate
   */
  resolve<T>(clazz: Newable<T>): T;
}

class UnknownDependency<T> implements IConfiguredDependency<T> {
  constructor(readonly key: string, private readonly values: Record<string, IConfiguredDependency<any>>) {}

  isResolved(): boolean {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resolveValue(container: IServiceContainer): T {
    console.log(Object.keys(this.values));
    throw new Error(`Unrecognized service: ${this.key}`);
  }

  clone(): IConfiguredDependency<T> {
    return this;
  }
}

export class ServiceContainer implements IServiceContainer {
  private readonly values: Record<string, IConfiguredDependency<any>>;

  constructor(values: Record<string, any>, private parent?: IServiceContainer, private provenance?: string) {
    this.values = values;
  }

  resolve<T>(clazz: Newable<T>): T {
    const factory = createAutoWireFactory(clazz);
    return factory(this);
  }

  private _getService<T>(key: string): T {
    let value = this.values[key];
    if (!value) {
      if (this.parent) {
        return this.parent.get<T>(key);
      }

      value = new UnknownDependency<T>(key, this.values);
    }

    return (value as IConfiguredDependency<T>).resolveValue(this);
  }

  get<T>(key: string): T;
  get<T1, T2>(keys: string[]): [T1, T2];
  get<T1, T2, T3>(keys: string[]): [T1, T2, T3];
  get<T1, T2, T3, T4>(keys: string[]): [T1, T2, T3, T4];
  get<T1, T2, T3, T4, T5>(keys: string[]): [T1, T2, T3, T4, T5];
  get<T1, T2, T3, T4, T5, T6>(keys: string[]): [T1, T2, T3, T4, T5, T6];
  get<T1, T2, T3, T4, T5, T6, T7>(keys: string[]): [T1, T2, T3, T4, T5, T6, T7];
  get<T1, T2, T3, T4, T5, T6, T7, T8>(keys: string[]): [T1, T2, T3, T4, T5, T6, T7, T8];
  get<T1, T2, T3, T4, T5, T6, T7, T8, T9>(keys: string[]): [T1, T2, T3, T4, T5, T6, T7, T8, T9];
  get<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(keys: string[]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10];
  get<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(
    keys: string | string[],
  ):
    | T1
    | [T1, T2]
    | [T1, T2, T3]
    | [T1, T2, T3, T4]
    | [T1, T2, T3, T4, T5]
    | [T1, T2, T3, T4, T5, T6]
    | [T1, T2, T3, T4, T5, T6, T7]
    | [T1, T2, T3, T4, T5, T6, T7, T8]
    | [T1, T2, T3, T4, T5, T6, T7, T8, T9]
    | [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10] {
    if (!Array.isArray(keys)) {
      return this._getService<T1>(keys);
    }

    if (keys.length === 2) {
      return [this._getService<T1>(keys[0]), this._getService<T2>(keys[1])];
    }

    if (keys.length === 3) {
      return [this._getService<T1>(keys[0]), this._getService<T2>(keys[1]), this._getService<T3>(keys[2])];
    }

    if (keys.length === 4) {
      return [
        this._getService<T1>(keys[0]),
        this._getService<T2>(keys[1]),
        this._getService<T3>(keys[2]),
        this._getService<T4>(keys[3]),
      ];
    }

    if (keys.length === 5) {
      return [
        this._getService<T1>(keys[0]),
        this._getService<T2>(keys[1]),
        this._getService<T3>(keys[2]),
        this._getService<T4>(keys[3]),
        this._getService<T5>(keys[4]),
      ];
    }

    if (keys.length === 6) {
      return [
        this._getService<T1>(keys[0]),
        this._getService<T2>(keys[1]),
        this._getService<T3>(keys[2]),
        this._getService<T4>(keys[3]),
        this._getService<T5>(keys[4]),
        this._getService<T6>(keys[5]),
      ];
    }

    if (keys.length === 7) {
      return [
        this._getService<T1>(keys[0]),
        this._getService<T2>(keys[1]),
        this._getService<T3>(keys[2]),
        this._getService<T4>(keys[3]),
        this._getService<T5>(keys[4]),
        this._getService<T6>(keys[5]),
        this._getService<T7>(keys[6]),
      ];
    }

    if (keys.length === 8) {
      return [
        this._getService<T1>(keys[0]),
        this._getService<T2>(keys[1]),
        this._getService<T3>(keys[2]),
        this._getService<T4>(keys[3]),
        this._getService<T5>(keys[4]),
        this._getService<T6>(keys[5]),
        this._getService<T7>(keys[6]),
        this._getService<T8>(keys[7]),
      ];
    }

    if (keys.length === 9) {
      return [
        this._getService<T1>(keys[0]),
        this._getService<T2>(keys[1]),
        this._getService<T3>(keys[2]),
        this._getService<T4>(keys[3]),
        this._getService<T5>(keys[4]),
        this._getService<T6>(keys[5]),
        this._getService<T7>(keys[6]),
        this._getService<T8>(keys[7]),
        this._getService<T9>(keys[8]),
      ];
    }

    if (keys.length === 10) {
      return [
        this._getService<T1>(keys[0]),
        this._getService<T2>(keys[1]),
        this._getService<T3>(keys[2]),
        this._getService<T4>(keys[3]),
        this._getService<T5>(keys[4]),
        this._getService<T6>(keys[5]),
        this._getService<T7>(keys[6]),
        this._getService<T8>(keys[7]),
        this._getService<T9>(keys[8]),
        this._getService<T10>(keys[9]),
      ];
    }

    throw new Error('Unsupported overload');
  }

  destroy(key: string): void {
    const dependency = this.values[key] as ConfiguredDependency<any>;
    if (dependency && dependency.value) {
      if (typeof dependency.value.dispose === 'function') {
        dependency.value.dispose();
      }

      dependency.value = undefined;
    }
  }

  createChildContainer(provenance: string): IServiceContainer {
    const values: Record<string, IConfiguredDependency<any>> = {};
    const keys = Object.entries(this.values)
      .filter(([, value]) => !value.isResolved())
      .map(([key]) => key);

    keys.forEach((key) => {
      values[key] = this.values[key].clone();
    });

    return new ServiceContainer(values, this, provenance);
  }

  dispose(): void {
    const keys = Object.entries(this.values)
      .filter(([, value]) => {
        return value.isResolved();
      })
      .map(([key]) => key);

    keys.forEach((key) => this.destroy(key));
  }
}

export interface IServiceRegistry {
  configureServices(services: ServiceCollection): void;
}

export type RegistryConstructor<T extends IServiceRegistry> = new () => T;

/**
 * A collection of configured dependencies registered against unique keys.
 */
export class ServiceCollection {
  private values: Record<string, IConfiguredDependency<any>>;

  /**
   * Creates a new ServiceCollection
   * @param values Optional hash of configured dependencies (leave this unspecified in most cases).
   */
  constructor(values?: Record<string, IConfiguredDependency<any>>) {
    this.values = values ?? {};
  }

  /**
   * Register the specified key
   * @param key The key of the dependency
   * @param value Value (or value factory) for resolving the dependency
   */
  register<T>(key: string, value: T): ServiceCollection;
  register<T>(key: string, value: ValueFactoryDelegate<T>): ServiceCollection;
  register<T>(key: string, value: T | ValueFactoryDelegate<T>): ServiceCollection {
    this.values[key] = new ConfiguredDependency<T>(key, value);
    return this;
  }

  /**
   * Appends the specified dependency to the array of dependencies registered against the given key.
   * @param key The key of the dependencies
   * @param clazz A reference to the class (for auto-wiring)
   */
  add<T>(key: string, clazz: Newable<T>): ServiceCollection {
    let dependency = this.values[key] as ArrayDependency<T>;
    if (typeof dependency === 'undefined') {
      dependency = this.values[key] = new ArrayDependency<T>(key);
    }

    dependency.push(clazz);
    return this;
  }

  /**
   * Appends the specified dependency to the array of dependencies registered against the given key.
   * @param key The key of the dependencies.
   * @param value Value (or value factory) for resolving the dependency.
   */
  addDependency<T>(key: string, value: T | ValueFactoryDelegate<T>): ServiceCollection {
    let dependency = this.values[key] as ArrayDependency<T>;
    if (typeof dependency === 'undefined') {
      dependency = this.values[key] = new ArrayDependency<T>(key);
    }

    dependency.register(value);
    return this;
  }

  /**
   * Registers an auto-wired dependency for the given key.
   * @param key The key of the dependency.
   * @param clazz The class to auto-wire.
   */
  use<T>(key: string, clazz: Newable<T>): ServiceCollection {
    return this.register(key, createAutoWireFactory<T>(clazz));
  }

  /**
   * Retrieves the underlying hash of configured dependencies.
   * @returns The underlying hash of configured dependencies.
   */
  getValues(): Record<string, IConfiguredDependency<any>> {
    return this.values;
  }

  /**
   * Creates an implementation of IServiceContainer with all of the configured dependencies.
   * @returns The configured container.
   */
  buildContainer(): ServiceContainer {
    return new ServiceContainer(this.values);
  }

  /**
   * Whether the key has been registered.
   * @param key The dependency to query for.
   * @returns Whether the key has been registered.
   */
  isRegistered(key: string): boolean {
    return typeof this.values[key] !== 'undefined';
  }

  /**
   * Imports the service collection and copies over the configured dependencies.
   * @param collection The collection to import.
   */
  import(collection: ServiceCollection): void {
    this.values = {
      ...this.values,
      ...collection.values,
    };
  }

  /**
   * Runs the specified registry and imports the configured dependencies.
   * @param registry The registry to import.
   */
  importRegistry<Registry extends IServiceRegistry>(registry: RegistryConstructor<Registry>): void {
    const instance = new registry();
    instance.configureServices(this);
  }

  /**
   * Runs the specified registry and imports the configured dependencies.
   * @param registry The registry to import.
   */
  include(registry: IServiceRegistry): void {
    const services = new ServiceCollection();
    registry.configureServices(services);

    this.import(services);
  }

  /**
   * USE THIS WITH EXTREME CAUTION!
   * Order matters here since you're creating a temporary container.
   * This is typically only used in the registration process for resolving settings.
   * @param key The key of the dependency to resolve
   */
  resolve<T>(key: string): T {
    const container = this.buildContainer();
    try {
      return container.get<T>(key);
    } finally {
      container.dispose();
    }
  }
}

export class ServiceContainerStack {
  private stack: Stack<IServiceContainer>;

  constructor(root: IServiceContainer) {
    this.stack = new Stack<IServiceContainer>();
    this.stack.push(root);
  }

  current(): IServiceContainer {
    const container = this.stack.peek();
    if (!container) {
      throw new Error('No container found');
    }

    return container;
  }

  push(container: IServiceContainer): void {
    this.stack.push(container);
  }

  pop(): void {
    this.stack.pop();
  }
}
