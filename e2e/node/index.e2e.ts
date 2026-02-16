import assert from "node:assert/strict";
import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from "@apollo/client/core";
import { loadDevMessages, loadErrorMessages } from "@apollo/client/dev";
import { onError as apolloOnError } from "@apollo/client/link/error";
import { createFakeServer, normalizeFakeServerConfig } from "@newmo/graphql-fake-server";
import { GraphQLClient } from "graphql-request";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createFakeClient } from "./generated/fake.js";
import type { FragmentType } from "./generated/fragment-masking.js";
import {
    type BookFragmentPartsFragment,
    CreateBookDocument,
    type CreateBookInput,
    CreateFooUrlDocument,
    GetBooksDocument,
    GetBookWithFragmentsDocument,
    GetDogDocument,
    GetSimpleUnionDocument,
    GetUserNamesArrayExampleDocument,
    GotUnionUserDocument,
    UseMutationErrorPatternMutationDocument,
    type UseMutationErrorPatternMutationMutation,
} from "./generated/graphql.js";

loadDevMessages();
loadErrorMessages();

const fakeClient = createFakeClient({
    fakeServerEndpoint: "http://127.0.0.1:4000/fake",
});

// Utility function to create Apollo Client with cache disabled
const createApolloClient = (options: {
    uri: string;
    sequenceId?: string;
    errorLink?: ApolloLink;
}) => {
    const { uri, sequenceId, errorLink } = options;

    const httpLink = new HttpLink({
        uri,
        fetch,
        headers: sequenceId ? { "sequence-id": sequenceId } : {},
    });

    const links = errorLink ? [errorLink, httpLink] : [httpLink];

    return new ApolloClient({
        link: ApolloLink.from(links),
        cache: new InMemoryCache(),
        defaultOptions: {
            query: {
                fetchPolicy: "no-cache",
            },
            mutate: {
                fetchPolicy: "no-cache",
            },
        },
    });
};

describe("integration test", async () => {
    let server: Awaited<ReturnType<typeof createFakeServer>>;
    let fakeServerUrl = "";
    beforeAll(async () => {
        server = await createFakeServer(
            normalizeFakeServerConfig({
                schemaFilePath: "./api/api.graphqls",
                logLevel: "debug",
                server: {
                    ports: {
                        fakeServer: 4000,
                        apolloServer: 4002,
                    },
                },
                mock: {
                    defaultValues: {
                        CustomScalar: {
                            DATE_YYYYMMDD: `"2022-01-01"`,
                        },
                    },
                },
            }),
        );
        const { urls } = await server.start();
        fakeServerUrl = urls.fakeServer;
    });
    afterAll(() => {
        server?.stop();
    });
    describe("without fake", () => {
        it("should work createFooURL mutation", async () => {
            // request to server
            const client = createApolloClient({
                uri: `${fakeServerUrl}/graphql`,
            });
            const response = await client.mutate<CreateBookInput>({
                mutation: CreateFooUrlDocument,
                variables: {
                    input: {
                        URL: "https://example.com",
                    },
                },
            });
            expect(response.data).toMatchInlineSnapshot(`
              {
                "createFooURL": {
                  "URL": "string",
                  "__typename": "FooURLPayload",
                  "errors": [
                    {
                      "__typename": "CreateFooURLErrorDetail",
                      "code": "FAILED_TO_CREATE_FOO_URL",
                      "message": "string",
                    },
                    {
                      "__typename": "CreateFooURLErrorDetail",
                      "code": "FAILED_TO_CREATE_FOO_URL",
                      "message": "string",
                    },
                    {
                      "__typename": "CreateFooURLErrorDetail",
                      "code": "FAILED_TO_CREATE_FOO_URL",
                      "message": "string",
                    },
                  ],
                },
              }
            `);
        });
        it("should return Custom Scalar Default Fake Value", async () => {
            const _sequenceId = crypto.randomUUID();
            const client = new GraphQLClient(`${fakeServerUrl}/graphql`);
            // get fake response
            const response = await client.request(GotUnionUserDocument);
            expect(response).toMatchInlineSnapshot(`
              {
                "unionUser": {
                  "birthDate": "2022-01-01",
                  "birthYYYYMM": "2022-01",
                  "id": "xxxx-xxxx-xxxx-xxxx_g6_c1",
                  "name": "string",
                },
              }
            `);
        });
        it("should return the first concrete type of a union (First | Second | Third)", async () => {
            const client = new GraphQLClient(`${fakeServerUrl}/graphql`);
            const response = await client.request(GetSimpleUnionDocument);
            // Union always returns the first concrete type declared in the schema
            expect(response.simpleUnion?.__typename).toBe("First");
            expect(response).toMatchInlineSnapshot(`
              {
                "simpleUnion": {
                  "__typename": "First",
                  "value": "first-value",
                },
              }
            `);
        });
    });
    describe("@example ", () => {
        it("should fetch array example values", async () => {
            // just request
            const client = new GraphQLClient(`${fakeServerUrl}/graphql`);
            // get fake response
            const response = await client.request(GetUserNamesArrayExampleDocument);
            expect(response).toMatchInlineSnapshot(`
          {
            "userNamesArray": {
              "names": [
                "name1",
                "name2",
              ],
            },
          }
        `);
        });
        it("request to server and get response", async () => {
            const response = await fetch(`${fakeServerUrl}/graphql`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    operationName: "GetAuthors",
                    query: `
                    query GetAuthors {
                      authors {
                        id
                        name
                        age
                        books {
                          title
                          author {
                            id
                          }
                          genre
                        }
                      }
                    }
                `,
                }),
            });
            const data = await response.json();
            expect(data).toMatchInlineSnapshot(`
              {
                "data": {
                  "authors": [
                    {
                      "age": 33,
                      "books": [
                        {
                          "author": {
                            "id": "author-id_g16_c4",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                        {
                          "author": {
                            "id": "author-id_g17_c5",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                        {
                          "author": {
                            "id": "author-id_g18_c6",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                      ],
                      "id": "author-id_g10_c1",
                      "name": "F. Scott Fitzgerald",
                    },
                    {
                      "age": 33,
                      "books": [
                        {
                          "author": {
                            "id": "author-id_g22_c7",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                        {
                          "author": {
                            "id": "author-id_g23_c8",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                        {
                          "author": {
                            "id": "author-id_g24_c9",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                      ],
                      "id": "author-id_g11_c2",
                      "name": "F. Scott Fitzgerald",
                    },
                    {
                      "age": 33,
                      "books": [
                        {
                          "author": {
                            "id": "author-id_g28_c10",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                        {
                          "author": {
                            "id": "author-id_g29_c11",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                        {
                          "author": {
                            "id": "author-id_g30_c12",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                      ],
                      "id": "author-id_g12_c3",
                      "name": "F. Scott Fitzgerald",
                    },
                  ],
                },
              }
            `);
        });
    });
    describe("/fake", () => {
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
            const resRegister = await fakeClient.registerGetBookWithFragmentsQueryResponse(
                sequenceId,
                {
                    __typename: "Query",
                    book: {
                        __typename: "Book",
                        id: "new id",
                        title: "new title",
                    } as FragmentType<BookFragmentPartsFragment>,
                },
            );
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

        it("register fake error response for query", async () => {
            const sequenceId = crypto.randomUUID();
            // register fake error response for GetBooks query
            const resRegister = await fakeClient.registerGetBooksQueryErrorResponse(sequenceId, {
                errors: [{ message: "fake error message" }],
                responseStatusCode: 400,
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
            try {
                await client.request(GetBooksDocument);
            } catch (e) {
                expect(e).toMatchInlineSnapshot(
                    `[Error: GraphQL Error (Code: 400): {"response":{"status":400,"headers":{}},"request":{"query":"query GetBooks {\\n  books {\\n    id\\n    title\\n  }\\n}"}}]`,
                );
            }
        });
        it("register fake response for mutation errors pattern", async () => {
            const sequenceId = crypto.randomUUID();
            // register fake response for UseFooBarMutationMutation mutation
            const _resRegister =
                await fakeClient.registerUseMutationErrorPatternMutationMutationResponse(
                    sequenceId,
                    {
                        __typename: "Mutation",
                        useMutationErrorPattern: {
                            __typename: "UseMutationErrorPatternPayload",
                            errors: [
                                {
                                    __typename: "GeneralError",
                                    message: "error message",
                                },
                            ],
                        },
                    },
                );
            // request to server
            const client = createApolloClient({
                uri: `${fakeServerUrl}/graphql`,
                sequenceId,
            });
            const response = await client.mutate<UseMutationErrorPatternMutationMutation>({
                mutation: UseMutationErrorPatternMutationDocument,
            });
            const errors = response.data?.useMutationErrorPattern.errors ?? [];
            const isError = errors.length > 0;
            expect(isError).toBe(true);
            expect(response).toMatchInlineSnapshot(`
        {
          "data": {
            "__typename": "Mutation",
            "useMutationErrorPattern": {
              "__typename": "UseMutationErrorPatternPayload",
              "errors": [
                {
                  "__typename": "GeneralError",
                  "message": "error message",
                },
              ],
            },
          },
        }
      `);
        });
        it("apollo client catch global errors", async () => {
            const sequenceId = crypto.randomUUID();
            // register fake response for UseFooBarMutationMutation mutation
            const _resRegister = await fakeClient.registerGetDogQueryErrorResponse(sequenceId, {
                errors: [
                    {
                        message: "test error",
                    },
                ],
                responseStatusCode: 400,
            });
            const spy = vi.fn();
            const errorLink = apolloOnError(spy);
            // request to server
            const client = createApolloClient({
                uri: `${fakeServerUrl}/graphql`,
                sequenceId,
                errorLink,
            });
            try {
                await client.query({
                    query: GetDogDocument,
                });
                throw new Error("not reach");
            } catch {
                expect(spy).toBeCalled();
            }
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
    describe("@error", () => {
        it("should return empty array for field with @error directive", async () => {
            const sequenceId = crypto.randomUUID();
            const client = new GraphQLClient(`${fakeServerUrl}/graphql`, {
                headers: {
                    "sequence-id": sequenceId,
                },
            });
            const query = `
              query {
                userWithErrors {
                  id
                  name
                  errors {
                    message
                  }
                }
              }
            `;
            const response = await client.request(query);
            expect(response).toMatchInlineSnapshot(`
              {
                "userWithErrors": {
                  "errors": [],
                  "id": "xxxx-xxxx-xxxx-xxxx_g31_c1",
                  "name": "string",
                },
              }
            `);
        });
    });

    describe("Conditional Fake", () => {
        it("should handle variables-based conditions", async () => {
            const sequenceId = crypto.randomUUID();
            const client = new GraphQLClient(`${fakeServerUrl}/graphql`, {
                headers: {
                    "sequence-id": sequenceId,
                },
            });

            // Register fake for specific input
            await fetch(`${fakeServerUrl}/fake`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    type: "operation",
                    operationName: "CreateBook",
                    requestCondition: {
                        type: "variables",
                        value: {
                            input: {
                                title: "Test Book A",
                                authorId: "author-1",
                            },
                        },
                    },
                    data: {
                        createBook: {
                            id: "book-a",
                            title: "Test Book A - Created",
                        },
                    },
                }),
            });

            // Register fake for different input
            await fetch(`${fakeServerUrl}/fake`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    type: "operation",
                    operationName: "CreateBook",
                    requestCondition: {
                        type: "variables",
                        value: {
                            input: {
                                title: "Test Book B",
                                authorId: "author-2",
                            },
                        },
                    },
                    data: {
                        createBook: {
                            id: "book-b",
                            title: "Test Book B - Created",
                        },
                    },
                }),
            });

            // Call with first input
            const firstResponse = await client.request(CreateBookDocument, {
                input: {
                    title: "Test Book A",
                    authorId: "author-1",
                },
            });
            expect((firstResponse as { createBook: { title: string } }).createBook.title).toBe(
                "Test Book A - Created",
            );

            // Call with second input
            const secondResponse = await client.request(CreateBookDocument, {
                input: {
                    title: "Test Book B",
                    authorId: "author-2",
                },
            });
            expect((secondResponse as { createBook: { title: string } }).createBook.title).toBe(
                "Test Book B - Created",
            );
        });
    });

    describe("Condition conflicts", () => {
        it("should reject count condition when default fake is already registered", async () => {
            const sequenceId = crypto.randomUUID();

            // First register default fake (no condition)
            const defaultResponse = await fetch(`${fakeServerUrl}/fake`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    type: "operation",
                    operationName: "GetBooks",
                    data: {
                        books: [{ id: "default-book", title: "Default Book" }],
                    },
                }),
            });
            expect(defaultResponse.ok).toBe(true);

            // Try to register count condition - should fail with invalid condition type error
            const countResponse = await fetch(`${fakeServerUrl}/fake`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    type: "operation",
                    operationName: "GetBooks",
                    requestCondition: { type: "count", value: 1 },
                    data: {
                        books: [{ id: "count-book", title: "Count Book" }],
                    },
                }),
            });
            expect(countResponse.ok).toBe(false);
            const errorResult = (await countResponse.json()) as { errors: string[] };
            expect(errorResult.errors).toContain(
                "Invalid request conditions: Unknown condition type 'count'. Allowed types: always, variables",
            );
        });

        it("should allow variables and default conditions to coexist", async () => {
            const sequenceId = crypto.randomUUID();

            // First register default fake (no condition)
            const defaultResponse = await fetch(`${fakeServerUrl}/fake`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    type: "operation",
                    operationName: "GetBooks",
                    data: {
                        books: [{ id: "default-book", title: "Default Book" }],
                    },
                }),
            });
            expect(defaultResponse.ok).toBe(true);

            // Register variables condition - should succeed
            const variablesResponse = await fetch(`${fakeServerUrl}/fake`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    type: "operation",
                    operationName: "GetBooks",
                    requestCondition: { type: "variables", value: { filter: "special" } },
                    data: {
                        books: [{ id: "special-book", title: "Special Book" }],
                    },
                }),
            });
            expect(variablesResponse.ok).toBe(true);
        });
    });

    describe("Host Header Validation", () => {
        it("should reject requests with invalid Host header", async () => {
            // Use Node's http module to have full control over Host header
            const http = await import("node:http");
            const url = new URL(`${fakeServerUrl}/graphql`);

            const response = await new Promise<{ statusCode: number; body: string }>((resolve) => {
                const req = http.request(
                    {
                        hostname: url.hostname,
                        port: url.port,
                        path: url.pathname,
                        method: "POST",
                        headers: {
                            Host: "evil.com:4000", // Invalid host header
                            "Content-Type": "application/json",
                        },
                    },
                    (res) => {
                        let body = "";
                        res.on("data", (chunk) => {
                            body += chunk;
                        });
                        res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, body }));
                    },
                );

                req.on("error", (err) => {
                    throw err;
                });

                // Send a GraphQL query
                req.write(
                    JSON.stringify({
                        query: "{ books { id } }",
                    }),
                );
                req.end();
            });

            // Should be rejected by Host header validation
            expect(response.statusCode).toBe(400);
            expect(response.body).toContain("Bad Request: Invalid Host header");
        });
    });
});
