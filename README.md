# @newmo/graphql-fake-server

A GraphQL fake server and toolkit for declarative and dynamic fakes.

## Motivation

`@newmo/graphql-fake-server` is for developers who use fake data against a GraphQL API.

It offers two complementary ways to fake responses:

- **Declarative Fake** — static fakes embedded in the schema via `@example*` directives. Good for default values, storybook-like screens, and read-only flows.
- **Dynamic Fake** — register responses at runtime over HTTP, keyed by a `sequence-id`. Good for integration tests, edge cases, and error paths.

The main interface is HTTP, so the fake server is usable from any language. For TypeScript projects, the [`@newmo/graphql-codegen-fake-server-client`](./packages/@newmo/graphql-codegen-fake-server-client) plugin generates a typed client and is the recommended way to drive dynamic fakes.

## Packages

This repository is a monorepo. The packages you will typically depend on are:

| Package | Role |
| --- | --- |
| [`@newmo/graphql-fake-server`](./packages/@newmo/graphql-fake-server) | The fake server CLI and programmatic API. |
| [`@newmo/graphql-fake-core`](./packages/@newmo/graphql-fake-core) | The mock-generation core used by the server. |
| [`@newmo/graphql-codegen-fake-server-client`](./packages/@newmo/graphql-codegen-fake-server-client) | GraphQL Code Generator plugin that emits a typed fake client. |
| [`@newmo/eslint-plugin-graphql-fake`](./packages/@newmo/eslint-plugin-graphql-fake) | ESLint rules for schemas that use the fake directives. |

## Architecture

When the fake server starts it actually exposes **two HTTP servers**:

| Server | Default port | Purpose |
| --- | --- | --- |
| Fake Server | `4000` | The endpoint your app talks to. Routes: `POST /graphql` (alias `/query`), `POST /fake`, `GET /fake/called`. Responses are driven by registered fakes (`/fake`) or fall back to declarative fakes from the schema. |
| Apollo Server | `4002` | A vanilla Apollo Server bound to the same schema for use with GraphQL Playground / introspection / schema sanity checks. It does **not** consult registered fakes. |

Both ports are configurable under `server.ports` (see [Configuration](#configuration)).

## Quick Start

### 1. Install

```bash
npm install @newmo/graphql-fake-server --save-dev
```

### 2. Add the directive prelude and example values to your schema

The fake directives must be declared in the schema before they can be used. The full prelude is in [`examples/e2e/node/api/api.graphqls`](./e2e/node/api/api.graphqls); copy it into your own schema (or `import` it from a separate file if your codegen supports schema composition).

```graphql
type Book {
  id: ID! @exampleID(value: "book-id")
  title: String! @exampleString(value: "The Great Gatsby")
  author: Author!
}
type Author {
  id: ID! @exampleID(value: "author-id")
  name: String! @exampleString(value: "F. Scott Fitzgerald")
  age: Int! @exampleInt(value: 33)
}
type Query {
  books: [Book!]!
}
```

### 3. Launch the fake server

```bash
$ npx @newmo/graphql-fake-server --schema graphql/schema.graphql
```

For non-trivial setups, use a config file instead of `--schema`:

```bash
$ npx @newmo/graphql-fake-server --config ./fake-server.config.mjs
```

The fake server defaults to `http://localhost:4000` and the Apollo Server to `http://localhost:4002`.

### 4. (Static path) Query the declarative fake

With no fakes registered, the server answers from the directives in the schema. For example:

```graphql
query {
  books {
    id
    title
    author {
      id
      name
      age
    }
  }
}
```

returns:

```json
{
  "data": {
    "books": [
      {
        "id": "book-id_g0_c0",
        "title": "The Great Gatsby",
        "author": {
          "id": "author-id_g1_c0",
          "name": "F. Scott Fitzgerald",
          "age": 33
        }
      },
      {
        "id": "book-id_g0_c1",
        "title": "The Great Gatsby",
        "author": {
          "id": "author-id_g1_c1",
          "name": "F. Scott Fitzgerald",
          "age": 33
        }
      }
    ]
  }
}
```

`@exampleID` values are decorated with a deterministic suffix so that every generated ID is unique:

```
${value}_g${global_id}_c${count}
   |          |             |
   |          |             └─ per-name counter, starts at 0
   |          └─ global counter across all @exampleID fields, starts at 0
   └─ the value passed to @exampleID(value: ...)
```

### 5. (Dynamic path) Register fakes from a TypeScript test

This is the recommended workflow for tests. Generate a typed client with [`@newmo/graphql-codegen-fake-server-client`](./packages/@newmo/graphql-codegen-fake-server-client):

```ts
// graphql-codegen.ts
import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "./api/schema.graphqls",
  documents: "./api/*.graphql",
  generates: {
    "./generated/": { preset: "client" },
    "./generated/fake-client.ts": {
      plugins: ["@newmo/graphql-codegen-fake-server-client"],
      config: { typesFile: "./graphql.js" },
    },
  },
};
export default config;
```

Then in test code:

```ts
import { createFakeClient } from "./generated/fake-client.js";
import { GetBooksDocument } from "./generated/graphql.js";

const fakeClient = createFakeClient({
  fakeServerEndpoint: "http://127.0.0.1:4000/fake",
});

const sequenceId = crypto.randomUUID();

// Register the response for a specific operation, type-checked against the schema.
await fakeClient.registerGetBooksQueryResponse(sequenceId, {
  __typename: "Query",
  books: [
    { __typename: "Book", id: "new id", title: "new title" },
  ],
});

// Make the request through your usual GraphQL client, propagating sequence-id.
const response = await fetch("http://127.0.0.1:4000/graphql", {
  method: "POST",
  headers: { "Content-Type": "application/json", "sequence-id": sequenceId },
  body: JSON.stringify({
    operationName: "GetBooks",
    query: GetBooksDocument.loc!.source.body,
  }),
}).then((r) => r.json());

// Inspect what the server received.
const called = await fakeClient.calledGetBooksQuery(sequenceId);
```

The pair `(sequence-id, operationName)` is the cache key for registered fakes. Use a fresh UUID per test (or per render in UI fake screens) to isolate cases.

### 6. (Dynamic path, HTTP only) Register fakes without TypeScript

If you are not using TypeScript codegen, drive the same flow with raw HTTP:

```ts
const sequenceId = "unique-sequence-id-1";
await fetch("http://127.0.0.1:4000/fake", {
  method: "POST",
  headers: { "Content-Type": "application/json", "sequence-id": sequenceId },
  body: JSON.stringify({
    type: "operation",
    operationName: "GetBooks",
    data: {
      books: [{ id: "book-id00", title: "The Great Gatsby" }],
    },
  }),
});
```

```ts
const response = await fetch("http://127.0.0.1:4000/query", {
  method: "POST",
  headers: { "Content-Type": "application/json", "sequence-id": sequenceId },
  body: JSON.stringify({
    operationName: "GetBooks",
    query: `query GetBooks { books { id title } }`,
  }),
});
```

When no fake is registered for a given `(sequence-id, operationName)`, the server falls back to the declarative fake defined by directives in the schema.

## Configuration

`fake-server.config.mjs` is the canonical configuration file. All fields except `schemaFilePath` are optional.

```js
/** @type {import("@newmo/graphql-fake-server").FakeServerConfig} */
const config = {
  schemaFilePath: "graphql/schema.graphql",
  logLevel: "info",
  server: {
    ports: {
      fakeServer: 4000,
      apolloServer: 4002,
    },
    maxQueryDepth: 10,
    maxRegisteredSequences: 1000,
    allowedCORSOrigins: ["https://app.example.com"],
    allowedHosts: "auto",
  },
  mock: {
    maxDepth: 9,
    maxTypeRecursion: 2,
    listLength: 3,
    defaultValues: {
      String: "string",
      Int: 12,
      Float: 12.3,
      Boolean: true,
      ID: "xxxx-xxxx-xxxx-xxxx",
      CustomScalar: {
        DATE_YYYYMMDD: "'2022-02-03'",
        ISODateTime: "new Date().toISOString()",
      },
    },
  },
};
export default config;
```

### Top level

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `schemaFilePath` | `string` | — (required) | Path to the GraphQL schema, resolved from cwd. |
| `logLevel` | `"debug" \| "info" \| "warn" \| "error"` | `"info"` | Server log verbosity. |
| `server` | `ServerConfig` | — | Network and limit settings (see below). |
| `mock` | `MockConfig` | — | Mock generation settings (see below). |

### `server`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `ports.fakeServer` | `number` | `4000` | Port for the fake server (the one your app talks to). |
| `ports.apolloServer` | `number` | `4002` | Port for the Apollo Playground server bound to the same schema. |
| `maxQueryDepth` | `number` | `10` | Maximum query depth accepted; deeper queries are rejected. |
| `maxRegisteredSequences` | `number` | `1000` | Upper bound on retained `sequence-id` entries. Oldest entries are evicted. |
| `allowedCORSOrigins` | `string[]` | `[]` | Extra origins allowed in addition to localhost and private IP ranges. |
| `allowedHosts` | `string[] \| "auto"` | `"auto"` | Allowed `Host` headers (DNS rebinding protection). `"auto"` derives the list from CORS origins and localhost. |

### `mock`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `maxDepth` | `number` | `9` | Maximum nesting depth when generating a mock response. |
| `maxTypeRecursion` | `number` | `2` | Maximum times a single type may recurse inside one response. |
| `listLength` | `number` | `3` | Number of items used when materialising list fields without an `@exampleArray*` directive. |
| `defaultValues.String` / `Int` / `Float` / `Boolean` / `ID` | scalar literal | see example | Default values used when no `@example*` directive is present. |
| `defaultValues.CustomScalar` | `Record<string, string>` | `{}` | Per-scalar default. Values are emitted **as code literals** by the codegen, so quote strings (`"'2022-02-03'"`) or pass an expression (`"new Date().toISOString()"`). |

> [!IMPORTANT]
> Custom scalar defaults live under `mock.defaultValues.CustomScalar`, not at the top level of the config. The values are inlined as TypeScript expressions, which is why strings must include their own quotes.

## Directive Reference

The directive prelude declares every directive the fake server understands. Drop it into your schema (see [`examples/e2e/node/api/api.graphqls`](./e2e/node/api/api.graphqls)).

### Primitives

| Directive | Target | Example |
| --- | --- | --- |
| `@exampleID(value: ID!)` | `ID` field | `id: ID! @exampleID(value: "book-id")` |
| `@exampleString(value: String!)` | `String` field | `name: String! @exampleString(value: "alice")` |
| `@exampleInt(value: Int!)` | `Int` field | `age: Int! @exampleInt(value: 33)` |
| `@exampleFloat(value: Float!)` | `Float` field | `height: Float! @exampleFloat(value: 1.7)` |
| `@exampleBoolean(value: Boolean!)` | `Boolean` field | `active: Boolean! @exampleBoolean(value: true)` |

`@exampleID` values are decorated with `_g<global>_c<count>` to keep IDs unique across the response.

### Arrays

| Directive | Target |
| --- | --- |
| `@exampleArrayID(values: [ID!]!)` | `[ID!]` field |
| `@exampleArrayString(values: [String!]!)` | `[String!]` field |
| `@exampleArrayInt(values: [Int!]!)` | `[Int!]` field |
| `@exampleArrayFloat(values: [Float!]!)` | `[Float!]` field |
| `@exampleArrayBoolean(values: [Boolean!]!)` | `[Boolean!]` field |

### Custom scalars

Custom scalars accept a directive on the `scalar` definition itself:

| Directive | Target |
| --- | --- |
| `@exampleScalarString(value: String!)` | `scalar CustomString @exampleScalarString(value: "example")` |
| `@exampleScalarInt(value: Int!)` | `scalar CustomCount @exampleScalarInt(value: 1)` |
| `@exampleScalarFloat(value: Float!)` | `scalar CustomRatio @exampleScalarFloat(value: 1.0)` |
| `@exampleScalarBoolean(value: Boolean!)` | `scalar CustomFlag @exampleScalarBoolean(value: true)` |

Scalars without a directive fall back to `mock.defaultValues.CustomScalar[<name>]` in the config file. If neither is set, the scalar is generated using the default for its kind.

### `@error`

`directive @error on FIELD_DEFINITION` marks fields that hold the error payload of a [union-error-pattern mutation](https://productionreadygraphql.com/2020-08-01-guide-to-graphql-errors). Fields marked `@error` default to an empty array in declarative fakes; populate them via dynamic fakes when you want to exercise error paths.

```graphql
type UserWithErrors {
  id: ID!
  name: String!
  errors: [GeneralError!]! @error
}
```

The companion ESLint rule [`@newmo/graphql-fake/required-error-directive`](./packages/@newmo/eslint-plugin-graphql-fake/docs/rules/required-error-directive.md) enforces that any field literally named `errors` carries `@error`.

### A complete example

```graphql
type TestThings {
  id: ID! @exampleID(value: "id")
  name: String! @exampleString(value: "example")
  age: Int! @exampleInt(value: 1)
  height: Float! @exampleFloat(value: 1.0)
  isBool: Boolean! @exampleBoolean(value: true)
  ids: [ID!]! @exampleArrayID(values: ["id1", "id2"])
  names: [String!]! @exampleArrayString(values: ["example1", "example2"])
  ages: [Int!]! @exampleArrayInt(values: [1, 2])
  heights: [Float!]! @exampleArrayFloat(values: [1.0, 2.0])
  isBools: [Boolean!]! @exampleArrayBoolean(values: [true, false])
}
```

## Conditional Fake Responses

A registered fake may carry a `requestCondition` so that different inputs return different data.

### `type: "always"`

Default response, matches every request. Equivalent to omitting `requestCondition`.

```ts
{
  type: "operation",
  operationName: "GetBooks",
  requestCondition: { type: "always" },
  data: { /* ... */ },
}
```

### `type: "variables"`

Matches only when the GraphQL `variables` are deeply equal to `value`.

```ts
{
  type: "operation",
  operationName: "GetUser",
  requestCondition: {
    type: "variables",
    value: { id: "admin", role: "admin" },
  },
  data: { /* admin-only response */ },
}
```

### Matching rules

- **Specificity**: `variables` (score 20) beats `always` (score 0).
- **Ties**: the most recently registered fake wins.
- **Fallback**: when no condition matches, the server falls back to the declarative fake from the schema.

## ESLint Plugin

[`@newmo/eslint-plugin-graphql-fake`](./packages/@newmo/eslint-plugin-graphql-fake) ships rules that catch the most common mistakes when authoring fake schemas:

- [`required-error-directive`](./packages/@newmo/eslint-plugin-graphql-fake/docs/rules/required-error-directive.md): requires the `@error` directive on fields named `errors`.

See the package README for installation and full configuration.

## Examples

- [`e2e/node`](./e2e/node) — the canonical example: schema, codegen, fake client, vitest integration tests, and `fake-server.config.mjs`.

## Limitations

Declarative fakes are static, which leads to a few constraints:

### Enum

`@newmo/graphql-fake-core` always returns the first value of an enum.

```graphql
enum Status {
  ACTIVE
  INACTIVE
}
type User {
  status: Status!
}
```

Returns:

```json
{ "data": { "user": { "status": "ACTIVE" } } }
```

To pick another value, either narrow with `@exampleString`:

```graphql
type User {
  status: Status! @exampleString(value: "INACTIVE")
}
```

or override with a dynamic fake.

### `union` and `interface`

For unions and interfaces the fake server picks the **first** concrete type declared and sets `__typename` accordingly. The choice is deterministic for a given schema.

```graphql
type User { id: ID! name: String }
type Suspended { reason: String }
type IsBlocked { message: String, blockedByUser: User }
union UserResult = User | IsBlocked | Suspended

type Query { user: UserResult }
```

Returns `User` because it is listed first. To return a different concrete type, register a dynamic fake.

### Custom scalar

Prefer `@exampleScalar*` directives on the scalar definition. As a fallback, set `mock.defaultValues.CustomScalar[<name>]` in the config — the value is inlined as code, so quote strings and use expressions where appropriate:

```js
mock: {
  defaultValues: {
    CustomScalar: {
      Digit: "1",
      DateYYYYMMDD: "'2022-02-03'",
      ISODateTime: "new Date().toISOString()",
    },
  },
}
```

### `operationName` is required

The fake server keys responses by `(sequence-id, operationName)`. Every request body must therefore include `operationName`:

```js
await fetch(`${urls.fakeServer}/graphql`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "sequence-id": sequenceId,
  },
  body: JSON.stringify({
    operationName: "GetDog", // required
    query: `query GetDog { dog { id name } }`,
  }),
});
```

## FAQ

### Can I use `@example*` directives on `input` types?

Yes. The fake server cannot fake request data, but the directive is preserved as documentation of an example input.

```graphql
input CreateDocumentInput {
  """
  Example input value. Does not affect runtime behaviour; serves as inline documentation.
  """
  name: String! @exampleString(value: "new doc")
}
```

### Where does newmo's own usage live?

newmo's internal apps generate one fake client per GraphQL graph (e.g. `@newmo-app/unkan-graph-client/fake-client`) and call it from Next.js `page.fake.tsx` files. The pattern is: mint a fresh `sequenceId = crypto.randomUUID()` per render, register the response via the generated client, then wrap the page in a provider that propagates the `sequence-id` header. The same pattern is reproducible outside Next.js by passing the header through any Apollo / urql / graphql-request client.

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b my-new-feature`.
3. Commit your changes.
4. Push to the branch: `git push origin my-new-feature`.
5. Open a pull request.

## License

MIT

## Credits

- [mizdra/graphql-codegen-typescript-fabbrica](https://github.com/mizdra/graphql-codegen-typescript-fabbrica)
- [graphql-kit/graphql-faker](https://github.com/graphql-kit/graphql-faker)
- [wayfair-incubator/gqmock](https://github.com/wayfair-incubator/gqmock)
