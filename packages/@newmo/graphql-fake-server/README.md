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
  /**
   * @type {string[] | "auto" | undefined}
   * Allowed Host headers for the fake server to prevent DNS rebinding attacks
   * - "auto" (default): Automatically generates allowed hosts from CORS origins and localhost addresses
   * - string[]: Explicit list of allowed Host headers
   * - undefined: Same as "auto"
   * @example ["localhost:4000", "myapp.local:4000"]
   */
  allowedHosts: undefined,
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
  /**
   * Allowed Host headers for the fake server to prevent DNS rebinding attacks
   * - "auto" (default): Automatically generates allowed hosts from CORS origins and localhost addresses
   * - string[]: Explicit list of allowed Host headers
   * @example ["localhost:4000", "myapp.local:4000"]
   */
  allowedHosts?: string[] | "auto" | undefined;
};
```

## Security

### Host Header Validation

The fake server implements Host header validation to prevent DNS rebinding attacks. This security feature:

- **Validates all incoming requests** to ensure the Host header matches allowed values
- **Defaults to "auto" mode** which automatically generates allowed hosts from:
  - Standard localhost addresses (localhost, 127.0.0.1, [::1], 0.0.0.0)
  - Hosts extracted from configured CORS origins
  - Both original ports and server ports for each hostname
- **Supports manual configuration** for special deployment scenarios
- **Displays security configuration on startup** for transparency

Example output on server startup:
```
🚀 Apollo Server started at http://0.0.0.0:4002
🔒 Security Configuration:
   - Allowed Hosts: auto (generated from CORS origins)
     • localhost:4002
     • 127.0.0.1:4002
     • [::1]:4002
     • 0.0.0.0:4002
     • frontend.local:3000
     • frontend.local:4002
   - CORS Origins: http://frontend.local:3000
```

This prevents attackers from bypassing same-origin policy through DNS rebinding attacks, similar to protections implemented in webpack-dev-server (CVE-2018-14732).

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
