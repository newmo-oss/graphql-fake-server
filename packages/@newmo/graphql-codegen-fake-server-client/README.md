# @newmo/graphql-codegen-fake-server-client

GraphQL Code Generator plugin that generates fake client for [@newmo/graphql-fake-server
](https://github.com/newmo-oss/graphql-fake-server).

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
      preset: "client",
    },
    "./generated/fake-client.ts": {
      plugins: ["@newmo/graphql-codegen-fake-server-client"],
      config: {
        // Required: path to the generated client's graphql file
        typesFile: "./graphql",
      },
    },
  },
};

export default config;
```

You can use `./generated/fake-client.ts` to register the fake to the fake server.

### Basic Usage

```ts
import { it, expect } from "vitest";
import { createFakeClient } from "./generated/fake-client";

const fakeClient = createFakeClient({
  fakeServerEndpoint: "http://localhost:4000",
});
it("register fake response for query", async () => {
  const sequenceId = crypto.randomUUID();
  // register fake response for GetBooks query
  const resRegister = await fakeClient.registerGetBooksQueryResponse(
    sequenceId,
    {
      books: [
        {
          id: "new id",
          title: "new title",
        },
      ],
    }
  );
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
  // Get actual request and response for testing
  const calledResults = await fakeClient.calledGetBooksDocumentQuery(
    sequenceId
  );
  console.log(calledResults[0].request);
  console.log(calledResults[0].response);
});
```

### Conditional Fake Responses

You can register conditional fake responses that return different results based on call count or variables. **The variables are now fully type-safe** based on your GraphQL operations:

```ts
import { it, expect } from "vitest";
import { createFakeClient } from "./generated/fake-client";

const fakeClient = createFakeClient({
  fakeServerEndpoint: "http://localhost:4000",
});

it("register conditional fake responses", async () => {
  const sequenceId = crypto.randomUUID();

  // Return different response on first call
  await fakeClient.registerGetBooksQueryResponse(
    sequenceId,
    {
      books: [{ id: "1", title: "First Call" }],
    },
    {
      requestCondition: { type: "count", value: 1 },
    }
  );

  // Return different response on second call
  await fakeClient.registerGetBooksQueryResponse(
    sequenceId,
    {
      books: [{ id: "2", title: "Second Call" }],
    },
    {
      requestCondition: { type: "count", value: 2 },
    }
  );

  // Type-safe variables condition!
  // TypeScript will enforce the correct variables shape for this operation
  await fakeClient.registerListDestinationCandidatesQueryResponse(
    sequenceId,
    {
      destinationCandidates: [{ id: "3", name: "Tokyo Station" }],
    },
    {
      requestCondition: {
        type: "variables",
        value: { text: "tokyo" }, // ✅ Type-safe! Must match ListDestinationCandidatesQueryVariables
      },
    }
  );

  // Another type-safe variables condition example
  await fakeClient.registerCreateUrlRideHistoryMutationResponse(
    sequenceId,
    {
      createURLRideHistory: { id: "4", name: "Specific Variables" },
    },
    {
      requestCondition: {
        type: "variables",
        value: { desinationName: "Shibuya" }, // ✅ Type-safe for this mutation!
      },
    }
  );
});
```

#### Type Safety Benefits

- **Variables validation**: TypeScript will ensure variables in conditions match the exact shape expected by your GraphQL operation
- **Autocomplete**: Your IDE will provide autocomplete for available variable fields
- **Compile-time errors**: Typos or wrong variable types will be caught at compile time
- **Refactoring safety**: If you change your GraphQL schema, TypeScript will help you update the affected conditions

## Options

- `typesFile` (required): Path to the generated client's graphql file.
- `fakeServerEndpoint` (optional): Fake server endpoint. Default is `http://127.0.0.1:4000/fake`.
- `namingConvention` (optional): Naming convention for the generated types. Default is `change-case#pascalCase`.
  - [Naming Convention](https://the-guild.dev/graphql/codegen/docs/config-reference/naming-convention)
- `typesPrefix` (optional): Prefix for the generated types.
- `typesSuffix` (optional): Suffix for the generated types.

## License

MIT
