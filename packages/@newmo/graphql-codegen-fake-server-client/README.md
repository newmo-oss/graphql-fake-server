# @newmo/graphql-codegen-fake-server-client

GraphQL Code Generator plugin for generating a fake server client.

## Installation

```sh
npm add --save-dev @newmo/graphql-codegen-fake-server-client
# This plugin depends on @graphql-codegen/client-preset
npm install @graphql-codegen/cli @graphql-codegen/client-preset --save-dev
```

GraphQL Code Generator configuration:

```ts
import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
    overwrite: true,
    schema: "./api/graphql/api.graphqls",
    documents: "./api/graphql/query.graphql",
    generates: {
        "./generated/": {
            preset: "client"
        },
        "./generated/fake-client.ts": {
            plugins: ["@newmo/graphql-codegen-fake-server-client"],
            config: {
                // Required: path to the generated client's graphql file
                typesFile: "./graphql"
            },
        },
    },
};

export default config;
```

You can use `./generated/fake-client.ts` to register the fake to the fake server.

```ts
import { registerFake } from "./generated/fake-client";
it("register fake response for query", async () => {
    const sequenceId = crypto.randomUUID();
    // register fake response for GetBooks query
    const resRegister = await registerGetBooksQueryResponse(sequenceId, {
        books: [
            {
                id: "new id",
                title: "new title",
            },
        ],
    });
    expect(resRegister).toMatchInlineSnapshot(`"{"ok":true}"`);
    // request to server
    const client = new GraphQLClient(`${fakeServerUrl}/graphql`, {
        headers: {
            "sequence-id": sequenceId,
        },
    });
    // Got fake response
    const response = await client.request(GetBooksDocument);
    expect(response).toMatchInlineSnapshot(`
          {
            "books": [
              {
                "id": "new id",
                "title": "new title",
              },
            ],
          }
        `);
});
```

## Options

- `typesFile` (required): Path to the generated client's graphql file.
- `fakeServerEndpoint` (optional): Fake server endpoint. Default is `http://127.0.0.1:4000/fake`.

## License

MIT
