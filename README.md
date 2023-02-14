# @aesop-fables/containr

`containr` is a lightweight Inversion of Control framework for Typescript. It is based on concepts/apis from `StructureMap` and Microsoft's Dependency Injection tooling.

## Installation
```
npm install @aesop-fables/containr
```
```
yarn add @aesop-fables/containr
```

## Usage
By and large, you really only do two kinds of things with `containr`:

1. Configure the container by registering the what and how `containr` should build or find requested services based on a key.
2. Resolve object instances of a service or dependency built out with all of its dependencies.

## Core Concepts

### Configuring dependencies
In `containr`, values are registered against unique keys (strings). When you request for the container to `get` a dependency, you use a key to refer to it. The resolution logic works like:

1. If the value has already been resolved (or the dependency was registered as a resolved value), then return the value.
2. If the value hasn't been resolved and a factory was specified, invoke the factory and cache the value
3. If the value hasn't been resolved and auto-wiring is being used, read the `@inject` decorator usage and determine which dependecies to resolve and pass them into the constructor.

### The "Bootstrapping" Phase
The process of creating a container is known as the `bootstrapping` phase (or used as a verb to refer to the act of creating the container). 

### Auto-wiring
Due to limitations in Typescript's support for overloading, there are functions
designed for registering dependencies to use auto-wiring (e.g., add, use).

### Service Modules
Service modules are blocks of code that are used to modify a `ServiceCollection`. They're designed to be reused and shared across projects (exported from custom npm packages). While it can be argued that it overlaps with React's naming conventions for hooks, we've employed a `use*` naming convention for service modules (e.g., `useMyApi`).

## Example
```typescript
// CaseApi.ts
import { AxiosInstance } from 'axios';
import { AxiosKeys } from '@aesop-fables/containr-axios';
import { IErrorRelay, ErrorRelayKeys } from '@aesop-fables/containr-error-relay';
import { inject } from '@aesop-fables/containr';

export interface ViewCaseModel {
    id: string;
    title: string;
    // ....
}

export interface ICaseApi {
    getCaseById(id: string): Promise<ViewCaseModel | null>;
}

export class CaseApi implements ICaseApi {
    constructor(
        @inject(AxiosKeys.Axios) private readonly axios: AxiosInstance,
        @inject(ErrorRelayKeys.Relay) private readonly errorRelay: IErrorRelay,
    ) {}

    getCaseById(id: string): Promise<ViewCaseModel | null> {
        return this.errorRelay.execute<ViewCaseModel>('CaseApi', async () => {
            const { data } = await this.axios.get<ViewCaseModel>(`/cases/${id}`);
            return data;
        });
    }
}

// bootstrap.ts
import { createContainer, createServiceModule } from '@aesop-fables/containr';
import { useAxios } from '@aesop-fables/containr-axios';
import { ICaseApi, CaseApi } from './CaseApi';
import CaseServiceKeys from './CaseServiceKeys';

const useCaseServices = createServiceModule('cases', (services) => {
    services.use<ICaseApi>(CaseServiceKeys.Api, CaseApi);
});

export default function() {
    return createContainer([
        useAxios,
        useCaseServices,
    ]);
}

// App.tsx
import React from 'react';
import bootstrap from './Bootstrap';
import { ServiceContainer } from '@aesop-fables/containr-react';

const container = bootstrap();
export const App: React.FC = () => {
    return (
        <ServiceContainer container={container}>
         // ...
        </ServiceContainer>
    );
};

// ViewCase.tsx
import React from 'react';
import { ICaseApi } from './CaseApi';
import { useService } from '@aesop-fables/containr-react';
import CaseServiceKeys from './CaseServiceKeys';

export ViewCase: React.FC = ({ route }) => {
    const { id } = route;
    const [isLoading, setIsLoading] = useState(true);
    const [caseModel, setCaseModel] = useState<ViewCaseModel | undefined>(undefined);
    const caseApi = useService<ICaseApi>(CaseServiceKeys.Api);
    // We're using our error-relay framework that connects to react
    // so errors are handled at a higher level
    
    useEffect(() => {
        (async () => {
            try {
                const model = await caseApi.getCaseById(id);
                if (model) {
                    setCaseModel(model);
                }
            } finally {
                setIsLoading(false);
            }
        })();
    }
    }, [id]);

    if (isLoading) {
        return <p>Loading...</p>;
    }

    if (!caseModel) {
        return <div />;
    }

    return <p>{caseModel.title}</p>;
};
```