# @newmo/graphql-fake-server

GraphQL Fake Server.

## Usage

See <https://github.com/newmo-oss/graphql-fake-server>

## Features

- Integrate Apollo Server
- Support `/fake` API
- Support `/graphql` API

## Config

Please See [src/config.ts](src/config.ts)

```ts
/**
 * Configuration for the fake server.
 */
export type FakeServerConfig = {
    /**
     * The path to the GraphQL schema file.
     */
    schemaFilePath: string;
    ports?: {
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
    } | undefined;
    /**
     * The maximum number of registered sequences.
     * Default is 1000.
     */
    maxRegisteredSequences?: number | undefined;
    /**
     * The maximum number of depth of field recursion.
     * Default is 3.
     */
    maxFieldRecursionDepth?: RawConfig["maxFieldRecursionDepth"] | undefined;
    /**
     * The maximum number of depth of complexity of query
     * Default is 4
     */
    maxQueryDepth?: number | undefined;
    /**
     * Default values for scalar types.
     */
    defaultValues?: RawConfig["defaultValues"] | undefined;
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
