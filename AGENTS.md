## TL;DR (Agent Quickstart)
- Node 22.x; npm only
- ESM NodeNext; use relative imports with .js extensions
- PR checks (run in order): `tsc -p tests` → `npm run lint -- --max-warnings 0` → `npm run build` → `npm test`
- Fetch: use `retrySchemaFetch` or other retry method from `src/utils/retryFetch.ts`
- Validation: zod via `parse` (src/utils/parse.ts)
- Errors: throw `UserError`/`ServerError` (never send error via Response)
- No console.*; use `withSpan`/`setAttributes` for tracing (OpenTelemetry)

# Coding Agent Onboarding Guide

This guide equips an automated coding agent to work efficiently in this repository and avoid CI/build pitfalls. Trust these instructions first; only search if something here seems incomplete or contradicts reality.

Coding Agents should not edit this file. Only humans should edit this to ensure accuracy.

## What this repo is
- Backend API for the Project Alkanes ecosystem (aka Shovel Backend).
- Node.js + Express with TypeScript; MongoDB for persistence; strong validation and security middleware.
- Key tech: Node 22.x (CI), npm, Express 5, TypeScript 5, Vitest, ESLint, MongoDB driver, OpenTelemetry.
- ESM/TypeScript: Project uses ESM (`"type": "module"`) and `NodeNext` resolution. 
- Imports must be relative with a `js` extension. Required for NodeNext ESM resolution so compiled imports resolve correctly at runtime
- Formatting is enforced via ESLint. Prettier is not used.
- npm is the package manager. Do not use yarn or pnpm.

## High-level layout
```
src/
├── config/                # Configuration (env vars, DB connection)
├── database/              # MongoDB connection and index setup
├── instrumentation/       # OpenTelemetry setup and helpers
├── middleware/            # Express middleware (security, validation, ...)
├── routes/                # Express route handlers, organized by feature
├── services/              # Database operations
├── utils/                 # Utility functions (errors, parsing, fetch with retry) and business logic
└── index.ts               # App entry point (Express app, route wiring, DB connect)
tests/
├── test-utils/            # Test utilities and mock data
└── ...                    # Vitest tests, mirroring `src/` structure
```

## CI and pre-merge checks
GitHub Actions run on PRs and must pass:
1. Typecheck tests: `tsc -p tests`
2. Lint: `npm run lint -- --max-warnings 0`
3. Build: `npm run build`
4. Tests: `npm test`

Runner uses Node 22.x with npm cache. Any PR must pass these in this order. Mirror this locally before pushing.

## General Guidelines
- Do not terminate lines of code with semicolons, unless necessary
- In general, only export one class/function from each file. It is OK to export many types or constants. This makes it easier to mock specific dependencies in tests
  - This rule can be broken if exporting multiple small, functions with a similar scope, and similar dependencies (imports). As soon as a function becomes large enough (more than 10-20 LoC), or pulls in imports not needed by other functions in the same file, it should be separated into its own file
- All fetch requests should use a retry method from `src/utils/retryFetch.ts`. Typically `retrySchemaFetch` to provide strongly typed responses
- Define types in the file where they are used, or originate from. Do not use central files for types
- Prefer not explicitly specifying return types of methods, unless a different type is needed from what would be inferred
- BTC addresses passed as input should always be passed through `sanitiseAddress` (in `src/utils/sanitiseAddress.ts`)
- Route handlers (in the `src/routes` folder) should have minimal logic. Database operations should be in a Service class, and any significant logic should be extracted into a function, in the `src/utils` folder
- Do not use `console.log`/`console.warn`/`console.error` anywhere (source code or tests). Source code is instrumented with OpenTelemetry, and console logs in tests don't add value (assertions are what identify if a test passes or fails, not console output). Console logs just bloat the terminal output, and make it harder to identify real issues.
- If a method has more than 3 or 4 parameters, consider refactoring it to take a single object parameter instead. The type should be called `{FunctionName}Args` and should be defined just above where the function is defined. i.e. 
  - Don't do this: `function foo(w: string, x: string, y: string, z: string) { ... }`
  - Do this instead: `function foo({ w, x, y, z }: FooArgs) { ... }`
- For root level functions, prefer the `function` keyword instead of arrow functions. Arrow functions are fine if defining them inside another function, or passing them as argument to something
- Don't overuse comments. Aim to write self documenting code (i.e. write code so it is clear what it does without the need for comments). Only use comments where it is not clear what the code does or why it is needed

### Naming Guidelines
- Classes: PascalCase
- Functions: camelCase
- Constants: UPPER_CASE or PascalCase depending on context
  - If it is a hardcoded primitive constant use UPPER_CASE
  - If the value is derived at runtime, or it is not a primitive type, use PascalCase
- Files:
  - If a file exports only one class or function, it should be named exactly the same as the class/function, including casing
  - If it exports multiple functions, use kebab-casing with a name descriptive of all the functions
  - Do not use generic names like `utils` or `lib` for files. This is a sign that the contents of the file are not related, and should be split into multiple files

## Adding a new route (checklist)

1) Create a Service (src/services/MyFeatureService.ts)
   - Define the Mongo model (no `_id` in the type)
   - Keep logic minimal; add indexes if querying/sorting on new fields

2) Implement route handler (src/routes/my-feature.ts)
   - Validate input with zod and `parse` (src/utils/parse.ts)
   - Sanitise BTC addresses with `sanitiseAddress` (src/utils/sanitiseAddress.ts)
   - Call the Service; throw `UserError`/`ServerError` (src/utils/errors.ts)
   - Instrument complex operations with `withSpan` (src/instrumentation/instrumentation.ts)
   - Use `retrySchemaFetch` or other retry method from `src/utils/retryFetch.ts` for outbound fetches

3) Wire route in app entry (src/index.ts), keep handler logic thin

4) Tests (duplicate folder structure in `src`)
   - Use mongodb-memory-server per file
   - Arrange/Act/Assert, separate describe blocks per function
   - Reset collections in beforeEach

## Environment Variables
- Environment variables are stored in the `env` folder, with one `.env.*` file for each environment. These are checked into git
- Sensitive environment variables are encrypted using `@dotenvx/dotenvx`
- Non-sensitive environment variables should not be encrypted, so we can track changes to them via version control
- Environment variables are loaded in `env/env.ts`. They are loaded based on the value of `NODE_ENV`
  - `NODE_ENV='test'` (i.e. when running tests via Vitest): Loads `.env.sample`, which contains dummy/default values
  - `NODE_ENV='development'` or `NODE_ENV='production'`: Loads the file specified by the `DOTENV_PATH` environment variable. If `DOTENV_PATH` is not set, it loads `.env`. This file is not checked in to git, and is the developer's local environment configuration. `DOTENV_PATH` is always set in a deployed environment, and in local environments, it is typically not set
- `NODE_ENV` is NOT used to differentiate prod and non-prod environments (this is what `APP_ENV` is for). Instead it is used to differentiate from local development, and a deployed instance. This is exported via the strongly typed variable `ENV`
  - `test`: Running tests via Vitest
  - `development`: Local development
  - `production`: Running in a deployed cloud environment. This could still be non-prod
- It is preferred to export environment variables from `env/env-vars.ts`, however, this is not required
  - All required env vars should be in `env/env-vars.ts`, and is parsed with `zod`
  - If an env var would be required in prod, it should be made required in `env/env-vars.ts`, so we are made aware of invalid configuration when deploying
  - Boolean values should be set to the literal values `'true'` or `'false'`
  - Environment variables can be used to disable behaviour that we don't want when running locally (e.g. `INITIALISE_INDEXES`). For these, we can use the value of `ENV` to provide defaults
  - All variables in `env/env-vars.ts` should be exported as getter functions so they can be mocked in tests

## Environments
- `APP_ENV` is used to identify the specific environment. This is one of:
  - Production Environments. These are connected to the prod database
    - `prod`: Production deployment that is exposed via `api.shovel.space`
    - `stage`: Identical to production environment, but not exposed via `api.shovel.space`. This allows us to deploy a new version into a production environment as one final test before deploying it to production
  - NonProd environments. These are connected to the non-prod database
    - `dev`: Similar to prod, but connected to non prod database
    - `mock`: All BTC interactions are mocked in this environment, allowing for testing without the need to have, or spend any BTC
    - `testnet` (Not implemented yet): Same as `dev`, except all BTC interactions go to testnet
  - In local development, `APP_ENV` should be set to `local`

## Validation
- Both `joi` and `zod` are used for validation. `zod` should always be preferred over `joi` as it provides better types. `joi` is only used in legacy situations
- When validating with `zod`, use the `parse` method from `src/utils/parse.ts`
- Prefer validating body/search params inside of request handlers, instead of in middleware, as it provides better type safety
- Define `zod` schemas in the file in which they are used. Do not use central schema files

## Errors
- All errors thrown should be (or inherit from) `ServerError` or `UserError` defined in `src/utils/errors.ts`. These both inherit from `BaseError`
  - `UserError` is for any error where it is OK for the user to see the error
    - These are typically 4xx errors, but don't have to be (default is 400)
    - They are errors we would expect to see during proper usage
  - `ServerError` are for errors where we don't want the user to see it
    - These should always be 5xx errors (default is 500)
    - When these are thrown, the response will have a generic `Something went wrong` message
    - In general, these errors indicate something unexpected went wrong, and typically should not be caught in try-catch blocks
- Create subclasses of `ServerError` and `UserError` when a type of error might be thrown in multiple places. These may or may not contain additional logic, but the `name` property should always be equal to the name of the class. For one-off errors, it's fine to just use `UserError` or `ServerError`
- All `BaseError`s are caught in the global error handler, and generate an HTTP response based on the status code in the error
- When a `UserError` is caught, the message and name are in the response. The front end can use the name to identify the type of error
- Never use the `Response` object to send an error (4xx or 5xx) response
- Always throw an appropriate error instead, and set the status code using `withStatus` on the error. This is to ensure the error is reported to observability, ensures consistent response formats, and prevents the risk of continued execution (if a developer forgets to put a return statement)

## Observability
- OpenTelemetry is used for tracing. We do not use logging or metrics from OpenTelemetry at this stage
- OpenTelemetry is preloaded before the app starts in the `src/instrumentation/setup.ts` file
- Spans should not be marked as an error for 4xx errors (or anything where a user or third party could trigger the error). However errors in this case should still be recorded

- Helper methods are in `instrumentation/instrumentation.ts`
  - Wrap a function with `withSpan` to instrument that function (works with both sync and async functions)
  - Errors thrown in `withSpan` will be recorded, so no need to record exceptions unless they are caught and not rethrown
    - Guidance for what should be wrapped in `withSpan`
      - Anything that could throw an error, unless it is a core utility/helper method, and it would be obvious where the error came from (e.g. parse)
      - Anything sufficiently complex (> 20 LoC)
      - Anytime we want to record any properties (arguments, return value, API response, etc)
    - Anything too simple should not be instrumented
    - Anything that is called a lot should not be instrumented (as it adds overhead)
    - If in doubt, instrument it (wrap it in `withSpan`)
    - A tracer should be defined in the root of the file, with the name of the file
    - The span name should be the name of the function
    - Example usage:
      ```ts
      import { AttributeValue, Span, SpanStatusCode, trace, Tracer } from "@opentelemetry/api"

      const tracer = trace.getTracer('fileName')

      export const myFunction = withSpan(tracer, 'myFunction', async (x: number, y: string) => {
        setAttributes({ x, y })
        return result
      })
      
      ```
  - `executeSpan` is similar to `withSpan` but the code is executed immediately, instead of creating a function. This is rarely needed. Prefer using `withSpan`
  - `recordException` can be used to record an exception
    - This is rarely needed, because exceptions are recorded automatically by `withSpan`, but can be useful if an error is caught and handled
    - It takes a `setStatus` option (defaults to true), which you can set to false and the span is not marked as an error, which should be done if the error does not result in a 5xx error. 4xx errors should not mark the span as an error
  - `setAttributes` is used to add attributes to the current span. It allows for a deeply nested object to be passed in, and it will be flattened out by converting nested key values into dot separated paths. It also handles data types not typically allowed in OpenTelemetry, such as Date, null and ObjectId (from MongoDB). Support for other data types can be added if and when it is necessary
    - `withSpan` does not automatically add argument values, or return values, so `setAttributes` should be used to set argument values, and/or return values where it makes sense to
    - Do not put complex data types, or values that could be excessively large in `setAttributes`. If a complex data type is important to instrument, it could be json stringified to ensure it can be set properly
    - `setAttributes` may trigger a TypeScript error if the passed in type is defined as an interface. If this occurs, it can normally be resolved by redefining it as a type
  - Classes should extend `AutoInstrumentedClass` (`src/instrumentation/AutoInstrumentedClass.ts`). This automatically replaces all methods on the class with an equivalent wrapped in `withSpan` eliminating the need to create a tracer, and wrap methods in `withSpan`. `setAttributes` should still be used in each method though. `BaseService` extends from `AutoInstrumentedClass`, so all services are automatically instrumented

## Database (MongoDB)
- All database interactions occur through the singleton `database` exported from `src/database/database.ts`
- Indexes are defined in `src/database/indexes.ts`, and on startup indexes are created if they don't already exist
  - Any field that is used in a query, or used for sorting should be indexed
- Database operations should be abstracted via a Service, defined in the `src/services` folder
  - Typically, we have one service per MongoDB collection, but this doesn't have to be the case (e.g. PointsService)
  - The database model should be defined in the relevant Service file
  - The database model should not have the MongoDB `_id` defined, as the MongoDB sdk adds this automatically to responses
  - When defining database models, prefer nullable types over optional types (i.e. prefer `x: string | null` over `x?: string`). This eliminates the possibility the developer forgets to define a value when they should be. If they want null, it has to be explicit
- Services should typically contain minimal logic beyond what is required for the database operation
- All services should inherit from `BaseService<T>` where `T` is the collection model
  - The collection name should be defined on the class, and should reference the `DatabaseCollection` constants in `src/database/collections.ts`
    - e.g: `collectionName = DatabaseCollection.ArchivedTransactions`
  - The MongoDB collection can then be accessed via `this.collection`

## Tests
- Tests use Vitest and are in the `tests` folder
- The folder structure for tests should match the folder structure in `src`
- Utility functions for testing go in `test-utils`. This includes mock data, random helpers, etc.
- Each separate function tested should have a separate `describe` block
- Before each/after each blocks should go at the root of the file, not inside `describe` blocks, unless there are multiple `describe`s inside a file, and specific logic is needed for one of them
- Use the Arrange, Act, Assert pattern for tests
- Use setup functions where possible to remove code duplication. This is often preferable to `beforeEach` as a setup function can allow optional arguments and/or return values to the test
- Tests use `mongodb-memory-server` to mock the MongoDB database. Each file will have a separate instance of this, so the tests can't conflict with each other
  - The following before/after handlers should be used to ensure MongoDB is setup properly
    ```ts
    beforeAll(async () => {
      mongodb = await MongoMemoryServer.create()
      await database.connect(mongodb.getUri(), DB_NAME())
    })

    afterAll(async () => {
      await database.disconnect()
      await mongodb.stop()
    })

    beforeEach(async () => {
      // Delete any collections to start each test with a clean database. e.g.
      await database.getDb().collection(DatabaseCollection.Users).deleteMany({})
    })
    ```
- All tests have the following global setup, so do not add additional beforeEach blocks to reset mocks
  ```ts
  beforeEach(() => {
    vi.resetAllMocks()
    fetchMock.resetMocks()
  })

  afterEach(async () => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })
  ```

## Final guidance for agents
- Prefer the documented commands and order above. Only search the repo if something here fails or appears out-of-date
