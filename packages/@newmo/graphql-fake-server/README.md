# @newmo/graphql-fake-server

GraphQL Fake Server.

## Usage

See <https://github.com/newmo-oss/graphql-fake-server>

## Features

- Integrate Apollo Server
- Support `/fake` API
- Support `/fake/called` API
- Support `/graphql` API

## Usage

```
Usage: npx @newmo/graphql-fake-server --schema <path> [options]

Options:

    --config <path>       Path to a config file
    --schema <path>       Path to a schema file
    --logLevel <logLevel> log level: debug, info, warn, error
    --cwd <path>          Current working directory
    --help                Show help

Examples:

    # Provide a schema file - use default config
    npx @newmo/graphql-fake-server --schema api.graphql
    # Use a config file
    npx @newmo/graphql-fake-server --config graphql-fake-server.config.js
```

## HTTP APIs

### `/graphql` and `/query`

GraphQL Endpoint.

You need to set `sequence-id` header to identify the sequence with the request.

```js
await fetch(`${urls.fakeServer}/graphql`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "sequence-id": sequenceId,
  },
  body: JSON.stringify({
    query: `
            query GetBooks {
                books {
                    id
                    title
                }
            }
        `,
  }),
});
```

### `/fake`

Register fake response for GraphQL operation.

```js
await fetch(`${urls.fakeServer}/fake`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "sequence-id": sequenceId,
  },
  body: JSON.stringify({
    type: "operation",
    operationName: "CreateBook",
    data: {
      createBook: {
        id: "new-id",
        title: "new BOOK",
      },
    },
  }),
});
```

### `/fake/called`

Return request and response for the request with `sequence-id` and `operationName`.

```js
const calledResponse = await fetch(`${urls.fakeServer}/fake/called`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "sequence-id": sequenceId,
  },
  body: JSON.stringify({
    operationName: "CreateBook",
  }),
});
```

### Conditional Fake

You can register fake responses with conditions that determine when they should be returned. This allows for different responses based on request characteristics.

#### Supported Conditions

- **Count condition**: Return a specific response on the nth call
- **Variables condition**: Return a specific response when variables match exactly

#### Examples

**Count-based condition:**

```js
// Register a fake that only returns on the 2nd call
await fetch(`${urls.fakeServer}/fake`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "sequence-id": sequenceId,
  },
  body: JSON.stringify({
    type: "operation",
    operationName: "GetUser",
    requestCondition: {
      type: "count",
      value: 2,
    },
    data: {
      user: {
        id: "user123",
        name: "Second Call User",
      },
    },
  }),
});
```

**Variables-based condition:**

```js
// Register a fake that only returns when variables match exactly
await fetch(`${urls.fakeServer}/fake`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "sequence-id": sequenceId,
  },
  body: JSON.stringify({
    type: "operation",
    operationName: "GetUser",
    requestCondition: {
      type: "variables",
      value: { id: "admin", role: "admin" },
    },
    data: {
      user: {
        id: "admin",
        name: "Admin User",
      },
    },
  }),
});
```

When no condition matches, the server falls back to the declarative fake data defined in the GraphQL schema.

#### Condition Restrictions

To ensure predictable behavior, the following condition combinations are not allowed for the same operation within a sequence:

- **Count + Default**: Cannot mix count conditions with default (no condition) responses
- **Count + Variables**: Cannot mix count conditions with variables conditions

✅ **Allowed combinations:**

- Variables + Default: You can have both variables-specific responses and a default fallback
- Multiple Variables: Different variables conditions can coexist
- Multiple Count: Different count values can coexist

❌ **Rejected combinations:**

```js
// This will be rejected with an error response
// 1. Register default response
await fetch("/fake", { body: { operationName: "GetUser", data: {...} } });
// 2. Try to register count condition - ERROR!
await fetch("/fake", { body: { operationName: "GetUser", requestCondition: { type: "count", value: 1 }, data: {...} } });
```

## Config

You can customize the configuration by `--config` option.

```
npx @newmo/graphql-fake-server --config graphql-fake-server.config.mjs
```

Example of the config file: `graphql-fake-server.config.mjs`

```js
export default {
  schemaFilePath: "./api/api.graphql",
  ports: {
    fakeServer: 4000,
    apolloServer: 4002,
  },
  maxRegisteredSequences: 1000,
  maxQueryDepth: 10,
  maxFieldRecursionDepth: 9,
  logLevel: "info",
  /**
   * @type {string[] | undefined}
   * Allowed CORS origins for the fake server
   * If undefined, it allows localhost and internal network connections only
   * @example ["https://example.com", "https://app.example.com"]
   */
  allowedCORSOrigins: undefined,
};
```

`RequiredFakeServerConfig` schema:

```ts
type RequiredFakeServerConfig = {
  schemaFilePath: string;
  ports: {
    fakeServer: number;
    apolloServer: number;
  };
  maxRegisteredSequences: number;
  maxQueryDepth: number;
  maxFieldRecursionDepth: number;
  logLevel?: LogLevel;
  /**
   * Allowed CORS origins for the fake server
   * If undefined, it allows localhost and internal network connections only
   * @example ["https://example.com", "https://app.example.com"]
   */
  allowedCORSOrigins?: string[] | undefined;
};
```

## Tests

```sh
npm test
```

## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

## License

MIT
