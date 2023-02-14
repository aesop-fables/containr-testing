# @aesop-fables/containr-testing

`containr-testing` provides testing support when using `containr` for development.

## Installation
```
npm install @aesop-fables/containr-testing
```
```
yarn add @aesop-fables/containr-testing
```

## Example
One of the most common testing patterns (when using dependency injection) leverages mocks and/or stubs (we're generalizing quite a bit here). `containr-testing` provides the `InteractionContext<T>` class that allows you 
to automatically generate mocks for your dependencies using `jest-mock-extended`.

```typescript
// MyEntityService.ts
import { inject } from '@aesop-fables/containr';

export interface IEvent {
    correlationId: string;
}

export interface IEventPublisher {
    publish(event: IEvent): Promise<void>;
}

export const MyServices = {
    Publisher: 'publisher',
};

export class MyEntityService implements IEntityService {
    constructor(
        @inject(MyServices.Publisher) private readonly publisher: IEventPublisher,
    ) {}

    createEntity(name: string): Promise<void> {
        const entity = {
            id: 'you would probably generate this',
            name,
        };

        await this.publisher.push({
            correlationId: entity.id,
        });
    }
}

// MyEntityService.test.ts
import { IEventPublisher, MyEntityService, MyServices } from './MyEntityService';
import { createInteractionContext, InteractionContext } from '@aesop-fables/containr-testing';

describe('InteractionContext example', () => {
  let context: InteractionContext<MyEntityService>;

  beforeEach(() => {
    // This will automatically configured the context
    context = createInteractionContext(MyEntityService);

    // If you need to modify the underlying collection
    // You can do it - only if you do it BEFORE you call `context.classUnderTest`

    // Calls to `context.services` will reset the instance of classUnderTest as well as the underlying service container (if it's already been instantiated)
  });

  test('demo auto-mocking', async () => {
    // classsUnderTest is lazily evaluated and is only instantiated once (the first time you call the property)
    await context.classUnderTest.createEntity('Hello');

    // the context allows you to retrieve the mocks
    // You could obviously inspect the invocation and do more elaborate assertions
    expect(context.mockFor<IEventPublisher>(MyServices.Publisher).publish).toBeCalledTimes(1);
  });
});


```