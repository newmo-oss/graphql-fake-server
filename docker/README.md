# Docker Container for @newmo/graphql-fake-server

Docker file for @newmo/graphql-fake-server.

## Usage

Default:

- 4000: GraphQL Fake Server
- 4001: Apollo Playground Server

```bash
docker run -d -p 4000:4000 -p 4001:4001 -w `pwd` -v `pwd`:`pwd` newmo/graphql-fake-server --schema ./path/to/api.graphqls
```

You can use `http://localhost:4000` as fake server.

- `http://localhost:4000/graphql` for GraphQL endpoint
- `http://localhost:4000/fake` for Fake endpoint

## Custom Port

Create `graphql-fake-server.config.mjs`:

```
import path from "node:path";
/**
 * @type {import("@newmo/graphql-fake-server").FakeServerConfig}
 */
const config = {
  ports: {
    fakeServer: 6000,
    apolloServer: 6001
  },
  schemaFilePath: path.join(import.meta.dirname, "./path/to/api.graphqls"),
};
export default config;

```

and run:

```bash
docker run -d -p 6000:6000 -p 6001:6001 -w `pwd` -v `pwd`:`pwd` newmo/graphql-fake-server --config ./path/to/graphql-fake-server.config.mjs
```


## Development


### Build

```
docker build -t newmo/graphql-fake-server .
```
