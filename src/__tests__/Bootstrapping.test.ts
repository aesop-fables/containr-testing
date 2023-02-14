import 'reflect-metadata';
import {
  BootstrappingServices,
  createContainer,
  createServiceModule,
  IActivator,
  IServiceModule,
} from '../Bootstrapping';
import { ServiceCollection } from '../Container';

class TestActivator implements IActivator {
  isActivated = false;

  activate(): void {
    this.isActivated = true;
  }
}

describe('Bootstrapping', () => {
  describe('createContainer', () => {
    test('Always configures the service modules', () => {
      const key = 'foo:bar';
      class MyServiceModule implements IServiceModule {
        get name(): string {
          return key;
        }

        configureServices(services: ServiceCollection): void {
          services.use(key, MyServiceModule);
        }
      }
      const container = createContainer([new MyServiceModule()]);
      expect(container.get<MyServiceModule>(key).name).toBe(key);
    });

    test('Runs the activators when setting is true', () => {
      const testModule = createServiceModule('test', (services) => {
        services.add<IActivator>(BootstrappingServices.Activators, TestActivator);
      });

      const container = createContainer([testModule], { runActivators: true });
      const [activator] = container.get<IActivator[]>(BootstrappingServices.Activators);
      expect((activator as TestActivator).isActivated).toBeTruthy();
    });

    test('Does not run the activators when setting is false', () => {
      const testModule = createServiceModule('test', (services) => {
        services.add<IActivator>(BootstrappingServices.Activators, TestActivator);
      });

      const container = createContainer([testModule], { runActivators: false });
      const [activator] = container.get<IActivator[]>(BootstrappingServices.Activators);
      expect((activator as TestActivator).isActivated).toBeFalsy();
    });
  });
});
