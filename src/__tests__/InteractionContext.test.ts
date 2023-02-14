import 'reflect-metadata';
import { createInteractionContext, InteractionContext } from '../index';
import { inject } from '@aesop-fables/containr';

interface IDependency {
  handle(): void;
}

class Target {
  constructor(@inject('dependency') private readonly dependency: IDependency) {}

  execute(): void {
    this.dependency.handle();
  }
}

describe('InteractionContext', () => {
  let context: InteractionContext<Target>;

  beforeEach(() => {
    context = createInteractionContext(Target);
  });

  test('dynamically mocks the dependency', () => {
    context.classUnderTest.execute();
    expect(context.mockFor<IDependency>('dependency').handle).toBeCalledTimes(1);
  });
});
