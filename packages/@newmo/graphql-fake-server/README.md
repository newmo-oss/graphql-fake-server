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
        operationName: "CreateBook",
        query: `
        mutation CreateBook($title: String!) {
          createBook(title: $title) {
            id
            title
          }
        }
    `,
        variables: {
            title: "The Great Gatsby",
        },
    }),
});
```

### `/fake`

Register the fake data for `sequence-id` and `operationName`.

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
````

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
    maxFieldRecursionDepth: 9,
    maxQueryDepth: 10,
    defaultValues: {
        String: "string",
        Int: 1,
        Float: 1.1,
        Boolean: true,
    },
    allowedCORSOrigins: ["http://eample.localhost:3000"]
};
```


Please See [src/config.ts](src/config.ts)

```ts
/**
 * Configuration for the fake server.
 */
export type FakeServerConfig = {
    /**
     * The path to the GraphQL schema file from cwd.
     */
    schemaFilePath: string;
    /**
     * The ports for the fake server and Apollo Server.
     */
    ports?:
        | {
        /**
         * Fake Server port.
         * Default is 4000.
         */
        fakeServer?: number | undefined;
        /**
         * Apollo Server port.
         * It provides the GraphQL Playground.
         * Default is 4002.
         */
        apolloServer?: number | undefined;
    }
        | undefined;
    /**
     * The maximum number of registered sequences.
     * Default is 1000.
     */
    maxRegisteredSequences?: number | undefined;
    /**
     * The maximum number of depth of field recursion.
     * Default is 9.
     */
    maxFieldRecursionDepth?: RawConfig["maxFieldRecursionDepth"] | undefined;
    /**
     * The maximum number of depth of complexity of query
     * this value should be maxFieldRecursionDepth + 1
     * Default is 10
     */
    maxQueryDepth?: number | undefined;
    /**
     * Default values for scalar types.
     */
    defaultValues?: RawConfig["defaultValues"] | undefined;
    /**
     * Log level: "debug", "info", "warn", "error"
     * If you want to see the debug logs, set the logLevel to "debug".
     * Default is "info".
     */
    logLevel?: LogLevel | undefined;
    /**
    * Additional origins to allow for CORS requests.
    * By default, only localhost and private IP ranges are allowed.
    * This option allows you to specify additional origins to accept.
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
