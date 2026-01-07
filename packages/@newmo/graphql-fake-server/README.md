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

- **Variables condition**: Return a specific response when variables match exactly

#### Examples

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

To ensure predictable behavior, variables-based conditions and default (no condition) responses can coexist for the same operation within a sequence.

✅ **Allowed combinations:**

- Variables + Default: You can have both variables-specific responses and a default fallback
- Multiple Variables: Different variables conditions can coexist

## Config

You can customize the configuration by `--config` option.

```
npx @newmo/graphql-fake-server --config graphql-fake-server.config.mjs
```

Example of the config file: `graphql-fake-server.config.mjs`

```js
export default {
  schemaFilePath: "./api/api.graphql",
  logLevel: "info", // "debug" | "info" | "warn" | "error"
  server: {
    ports: {
      fakeServer: 4000,
      apolloServer: 4002,
    },
    maxRegisteredSequences: 1000,
    maxQueryDepth: 10,
    /**
     * @type {string[] | undefined}
     * Allowed CORS origins for the fake server
     * If undefined, it allows localhost and internal network connections only
     */
    allowedCORSOrigins: undefined,
    /**
     * @type {string[] | "auto" | undefined}
     * Allowed Host headers for the fake server to prevent DNS rebinding attacks
     * - "auto" (default): Automatically generates allowed hosts from CORS origins and localhost addresses
     * - string[]: Explicit list of allowed Host headers
     */
    allowedHosts: "auto",
  },
  mock: {
    /**
     * Maximum total nesting depth across all types.
     * Prevents deep chains like: Query -> Book -> Author -> Publisher -> ...
     */
    maxDepth: 9,
    /**
     * Maximum times a specific type can be visited in a single path.
     * Prevents same-type recursion like: User -> User -> User -> ...
     */
    maxTypeRecursion: 2,
    /** Number of elements to generate for array/list fields */
    listLength: 3,
    defaultValues: {
      String: "string",
      Int: 12,
      Float: 12.3,
      Boolean: true,
      ID: "xxxx-xxxx-xxxx-xxxx",
      // CustomScalar: { DATE_YYYYMMDD: '"2022-01-01"' }
    },
  },
};
```

### Config Schema

```ts
type FakeServerConfig = {
  /** Path to the GraphQL schema file (required) */
  schemaFilePath: string;
  /** Log level (default: "info") */
  logLevel?: "debug" | "info" | "warn" | "error";
  /** Server configuration */
  server?: {
    ports?: {
      fakeServer?: number;  // default: 4000
      apolloServer?: number; // default: 4002
    };
    maxRegisteredSequences?: number; // default: 1000
    maxQueryDepth?: number; // default: 10
    allowedCORSOrigins?: string[];
    allowedHosts?: string[] | "auto"; // default: "auto"
  };
  /** Mock data generation options */
  mock?: {
    maxDepth?: number; // default: 9
    maxTypeRecursion?: number; // default: 2
    listLength?: number; // default: 3
    defaultValues?: {
      String?: string;
      Int?: number;
      Float?: number;
      Boolean?: boolean;
      ID?: string;
      CustomScalar?: Record<string, string>;
    };
  };
};
```

### Depth Control

Mock generation uses two complementary depth controls to prevent heap overflow:

- **maxDepth**: Limits total nesting depth across ALL types (A -> B -> C -> D stops at depth limit)
- **maxTypeRecursion**: Limits how many times the SAME type can appear in a chain (User -> User -> User)

Both conditions must pass for generation to continue.

## Security

GraphQL Fake Server implements security features to prevent DNS rebinding and cross-origin attacks:

### Host Header Validation

- **Purpose**: Prevents DNS rebinding attacks
- **Default**: `"auto"` - automatically generates allowed hosts from CORS origins and localhost addresses
- **Configuration**: `allowedHosts` option accepts `"auto"`, `string[]`, or `undefined`

### CORS Configuration

- **Purpose**: Controls cross-origin requests
- **Default**: Allows only localhost and internal network connections
- **Configuration**: `allowedCORSOrigins` option accepts `string[]` or `undefined`

### Auto-generation Feature

When `allowedHosts` is `"auto"` (default), the server automatically:
- Extracts hostnames from configured CORS origins
- Adds standard localhost addresses (localhost, 127.0.0.1, [::1], 0.0.0.0)
- Allows both original and server ports for each hostname

This integration ensures consistent security policies and reduces configuration errors.

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
