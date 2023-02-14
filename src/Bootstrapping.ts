import { IServiceContainer, ServiceCollection } from './Container';

export type ServiceModuleMiddleware = (services: ServiceCollection) => void;
export type ServiceModuleMiddlewareWithOptions<Options> = (services: ServiceCollection, options: Options) => void;

export type ServiceModuleMiddlewareWithOptionsFactory<Options> = (options: Options) => IServiceModule;

/**
 * Represents a set of services to be registered in the IServiceContainer
 */
export interface IServiceModule {
  name: string;
  configureServices: ServiceModuleMiddleware;
}

/**
 * Represents a set of services to be registered in the IServiceContainer
 */
export class ServiceModule implements IServiceModule {
  public readonly name: string;
  private readonly middlware: ServiceModuleMiddleware;

  constructor(name: string, middleware: ServiceModuleMiddleware) {
    this.name = name;
    this.middlware = middleware;
  }

  configureServices(services: ServiceCollection): void {
    this.middlware(services);
  }
}

export class ServiceModuleWithOptions<Options> implements IServiceModule {
  public readonly name: string;
  public readonly options: Options;
  private readonly middlware: ServiceModuleMiddlewareWithOptions<Options>;

  constructor(name: string, options: Options, middleware: ServiceModuleMiddlewareWithOptions<Options>) {
    this.name = name;
    this.options = options;
    this.middlware = middleware;
  }

  configureServices(services: ServiceCollection): void {
    this.middlware(services, this.options);
  }
}

/**
 * Creates a service module to participate in the bootstrapping process.
 * @param name The name of the module.
 * @param middleware The registration middleware for registering services.
 * @returns The configured service module.
 */
export function createServiceModule(name: string, middleware: ServiceModuleMiddleware): IServiceModule {
  return new ServiceModule(name, middleware);
}

/**
 * Creates a service module (with generic options) to participate in the bootstrapping process.
 * @param name The name of the module.
 * @param factory The registration middleware for registering services.
 * @returns A factory for creating the configured service module.
 * @example
 * const useMyApi = createServiceModuleWithOptions<MyOptions>('MyAPI', (services, options) => {
 *   if (options.registerSomething) {
 *     services.use<ISomething>('something', Something);
 *   }
 * });
 * const container = createContainer([ useMyApi({ registerSomething: true }) ]);
 */
export function createServiceModuleWithOptions<Options>(
  name: string,
  factory: ServiceModuleMiddlewareWithOptions<Options>,
): ServiceModuleMiddlewareWithOptionsFactory<Options> {
  return (options: Options) => {
    return new ServiceModuleWithOptions<Options>(name, options, factory);
  };
}

/**
 * Represents a piece of code that needs to run during the bootstrapping phase of your application.
 */
export interface IActivator {
  /**
   * Executes the activator.
   */
  activate(): void;
}

export const BootstrappingServices = {
  Activators: 'activators',
};

export interface BootstrapOptions {
  /**
   * Whether to run all registered instances of IActivator.
   */
  runActivators: boolean;
}

const defaultOptions: BootstrapOptions = {
  runActivators: true,
};

/**
 * Creates a new instance of IServiceContainer using the specified service modules.
 * @param modules Service modules to bootstrap the container (use createServiceModule or createServiceModuleWithOptions to create your own).
 * @param options Bootstrapping options
 * @returns An instance of IServiceContainer bootstrapped from the specified modules.
 */
export function createContainer(
  modules: IServiceModule[],
  options: BootstrapOptions = defaultOptions,
): IServiceContainer {
  const services = new ServiceCollection();
  modules.forEach((module) => module.configureServices(services));

  const container = services.buildContainer();
  if (options.runActivators && services.isRegistered(BootstrappingServices.Activators)) {
    const activators = container.get<IActivator[]>(BootstrappingServices.Activators);
    if (activators && activators.length) {
      activators.forEach((x) => x.activate());
    }
  }

  return container;
}
