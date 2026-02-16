import assert from "node:assert/strict";
import { GraphQLClient } from "graphql-request";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FragmentType } from "./generated/fragment-masking.js";
import {
    type BookFragmentPartsFragment,
    CreateBookDocument,
    type CreateBookInput,
    GetBooksDocument,
    GetBookWithFragmentsDocument,
    GetDogDocument,
    GotUnionUserDocument,
} from "./generated/graphql.js";
import { createApolloClient, createTestFakeClient, startTestServer } from "./helpers.js";

const fakeClient = createTestFakeClient(4024);

describe("fake-registration", async () => {
    let server: Awaited<ReturnType<typeof startTestServer>>["server"];
    let fakeServerUrl = "";
    beforeAll(async () => {
        const result = await startTestServer({ fakeServer: 4024, apolloServer: 4025 });
        server = result.server;
        fakeServerUrl = result.urls.fakeServer;
    });
    afterAll(() => {
        server?.stop();
    });

    it("register fake response for query and get called request body", async () => {
        const sequenceId = crypto.randomUUID();
        // register fake response for GetBooks query
        const resRegister = await fakeClient.registerGetBooksQueryResponse(sequenceId, {
            __typename: "Query",
            books: [
                {
                    __typename: "Book",
                    id: "new id",
                    title: "new title",
                },
            ],
        });
        expect(resRegister).toMatchInlineSnapshot(`
              {
                "ok": true,
              }
            `);
        // request to server
        const client = new GraphQLClient(`${fakeServerUrl}/graphql`, {
            headers: {
                "sequence-id": sequenceId,
            },
        });
        // get fake response
        const response = await client.request(GetBooksDocument);
        expect(response).toMatchInlineSnapshot(`
        {
          "__typename": "Query",
          "books": [
            {
              "__typename": "Book",
              "id": "new id",
              "title": "new title",
            },
          ],
        }
      `);
        // get request body
        const calledResult = await fakeClient.calledGetBooksQuery(sequenceId);
        expect(calledResult.ok).toBeTruthy();
        expect(calledResult.data).toHaveLength(1);
        assert(calledResult.data[0]);
        expect(calledResult.data[0].requestTimestamp).toBeGreaterThan(0);
        expect(calledResult.data[0].request.body).toMatchInlineSnapshot(`
              {
                "operationName": "GetBooks",
                "query": "query GetBooks {
                books {
                  id
                  title
                }
              }",
              }
            `);
        expect(calledResult.data[0].response.body).toMatchInlineSnapshot(`
        {
          "data": {
            "__typename": "Query",
            "books": [
              {
                "__typename": "Book",
                "id": "new id",
                "title": "new title",
              },
            ],
          },
        }
      `);
    });
    it("register fake response for query Dog which is implemented an interface", async () => {
        const sequenceId = crypto.randomUUID();
        const resRegister = await fakeClient.registerGetDogQueryResponse(sequenceId, {
            __typename: "Query",
            dog: {
                __typename: "Dog",
                id: "dog id",
                name: "dog name",
            },
        });
        expect(resRegister).toMatchInlineSnapshot(`
              {
                "ok": true,
              }
            `);
        // request to server
        const client = new GraphQLClient(`${fakeServerUrl}/query`, {
            headers: {
                "sequence-id": sequenceId,
            },
        });
        // get fake response
        const response = await client.request(GetDogDocument);
        expect(response).toMatchInlineSnapshot(`
        {
          "__typename": "Query",
          "dog": {
            "__typename": "Dog",
            "id": "dog id",
            "name": "dog name",
          },
        }
      `);
    });
    it("register fake response for mutation and get called request body", async () => {
        const sequenceId = crypto.randomUUID();
        // register fake response for mutation
        const resRegister = await fakeClient.registerCreateBookMutationResponse(sequenceId, {
            __typename: "Mutation",
            createBook: {
                __typename: "Book",
                id: "new id",
                title: "new title",
            },
        });
        expect(resRegister).toMatchInlineSnapshot(`
              {
                "ok": true,
              }
            `);
        // request to server
        const client = createApolloClient({
            uri: `${fakeServerUrl}/graphql`,
            sequenceId,
        });
        // get fake response
        const response = await client.mutate<CreateBookInput>({
            mutation: CreateBookDocument,
            variables: {
                title: "new title",
            },
        });
        expect(response.data).toMatchInlineSnapshot(`
        {
          "__typename": "Mutation",
          "createBook": {
            "__typename": "Book",
            "id": "new id",
            "title": "new title",
          },
        }
      `);
        // get request body
        const calledResult = await fakeClient.calledCreateBookMutation(sequenceId);
        expect(calledResult.ok).toBeTruthy();
        expect(calledResult.data).toHaveLength(1);
        assert(calledResult.data[0]);
        expect(calledResult.data[0].request.body.variables.title).toBe("new title");
        expect(calledResult.data[0].requestTimestamp).toBeGreaterThan(0);
        expect(calledResult.data[0].request.body).toMatchInlineSnapshot(`
              {
                "extensions": {
                  "clientLibrary": {
                    "name": "@apollo/client",
                    "version": "4.0.3",
                  },
                },
                "operationName": "CreateBook",
                "query": "mutation CreateBook($title: String!) {
                createBook(input: {title: $title}) {
                  id
                  title
                  __typename
                }
              }",
                "variables": {
                  "title": "new title",
                },
              }
            `);
        // get response body
        expect(calledResult.data[0].response.body).toMatchInlineSnapshot(`
        {
          "data": {
            "__typename": "Mutation",
            "createBook": {
              "__typename": "Book",
              "id": "new id",
              "title": "new title",
            },
          },
        }
      `);
    });
    it("register fake data for union type", async () => {
        const sequenceId = crypto.randomUUID();
        const resRegister = await fakeClient.registerGotUnionUserQueryResponse(sequenceId, {
            __typename: "Query",
            unionUser: {
                __typename: "User",
                id: "student id",
                name: "student name",
                birthDate: "2022-01-01",
                birthYYYYMM: "2022-01",
            },
        });
        expect(resRegister).toMatchInlineSnapshot(`
              {
                "ok": true,
              }
            `);
        // request to server
        const client = new GraphQLClient(`${fakeServerUrl}/graphql`, {
            headers: {
                "sequence-id": sequenceId,
            },
        });
        // get fake response
        const response = await client.request(GotUnionUserDocument);
        expect(response).toMatchInlineSnapshot(`
        {
          "__typename": "Query",
          "unionUser": {
            "__typename": "User",
            "birthDate": "2022-01-01",
            "birthYYYYMM": "2022-01",
            "id": "student id",
            "name": "student name",
          },
        }
      `);
    });
    it("register fake response which use Fragment", async () => {
        const sequenceId = crypto.randomUUID();
        // register fake response for mutation
        const resRegister = await fakeClient.registerGetBookWithFragmentsQueryResponse(sequenceId, {
            __typename: "Query",
            book: {
                __typename: "Book",
                id: "new id",
                title: "new title",
            } as FragmentType<BookFragmentPartsFragment>,
        });
        expect(resRegister).toMatchInlineSnapshot(`
              {
                "ok": true,
              }
            `);
        // request to server
        const client = new GraphQLClient(`${fakeServerUrl}/graphql`, {
            headers: {
                "sequence-id": sequenceId,
            },
        });
        const response = await client.request(GetBookWithFragmentsDocument);
        expect(response).toMatchInlineSnapshot(`
        {
          "__typename": "Query",
          "book": {
            "__typename": "Book",
            "id": "new id",
            "title": "new title",
          },
        }
      `);
    });
    it("should override first fake with second fake", async () => {
        const sequenceId = crypto.randomUUID();
        // 1. register error repose - this will be overridden
        await fakeClient.registerGetDogQueryErrorResponse(sequenceId, {
            errors: [
                {
                    message: "test error",
                },
            ],
            responseStatusCode: 400,
        });
        // 2. register success response
        await fakeClient.registerGetDogQueryResponse(sequenceId, {
            __typename: "Query",
            dog: {
                __typename: "Dog",
                id: "dog id",
                name: "dog name",
            },
        });
        // request to server
        const client = createApolloClient({
            uri: `${fakeServerUrl}/graphql`,
            sequenceId,
        });
        const response = await client.query({
            query: GetDogDocument,
        });
        expect(response.data).toMatchInlineSnapshot(`
              {
                "__typename": "Query",
                "dog": {
                  "__typename": "Dog",
                  "id": "dog id",
                  "name": "dog name",
                },
              }
            `);
    });
    it("should validate response structure for Query", async () => {
        const sequenceId = crypto.randomUUID();

        await fakeClient.registerGetBooksQueryResponse(sequenceId, {
            __typename: "Query",
            books: [{ __typename: "Book", id: "test-id", title: "test-title" }],
        });

        const client = new GraphQLClient(`${fakeServerUrl}/graphql`, {
            headers: { "sequence-id": sequenceId },
        });
        await client.request(GetBooksDocument);

        const calledResult = await fakeClient.calledGetBooksQuery(sequenceId);
        assert(calledResult.data[0]);
        const response = calledResult.data[0].response;

        // Validate entire structure matches expected format
        // https://github.com/graphql/graphql-spec/blob/main/spec/Section%207%20--%20Response.md#data
        // https://github.com/newmo-oss/graphql-fake-server/blob/main/packages/%40newmo/graphql-fake-server/src/server.ts
        expect(response).toMatchObject({
            status: expect.any(Number),
            headers: expect.any(Object),
            body: {
                data: {
                    __typename: "Query",
                    books: expect.any(Array),
                },
            },
        });
    });
    it("should validate response structure for Mutation", async () => {
        const sequenceId = crypto.randomUUID();

        await fakeClient.registerCreateBookMutationResponse(sequenceId, {
            __typename: "Mutation",
            createBook: { __typename: "Book", id: "book-1", title: "Test Book" },
        });

        const client = createApolloClient({ uri: `${fakeServerUrl}/graphql`, sequenceId });
        await client.mutate({
            mutation: CreateBookDocument,
            variables: { title: "Test Book" },
        });

        const calledResult = await fakeClient.calledCreateBookMutation(sequenceId);
        assert(calledResult.data[0]);
        const response = calledResult.data[0].response;

        // Validate entire structure matches expected format
        // https://github.com/graphql/graphql-spec/blob/main/spec/Section%207%20--%20Response.md#data
        // https://github.com/newmo-oss/graphql-fake-server/blob/main/packages/%40newmo/graphql-fake-server/src/server.ts
        expect(response).toMatchObject({
            status: expect.any(Number),
            headers: expect.any(Object),
            body: {
                data: {
                    __typename: "Mutation",
                    createBook: expect.any(Object),
                },
            },
        });
    });
});
