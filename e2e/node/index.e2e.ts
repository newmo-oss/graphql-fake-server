import assert from "node:assert/strict";
import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from "@apollo/client/core";
import { loadDevMessages, loadErrorMessages } from "@apollo/client/dev";
import { onError as apolloOnError } from "@apollo/client/link/error/index.js";
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
describe("integration test", async () => {
    let server: Awaited<ReturnType<typeof createFakeServer>>;
    let fakeServerUrl = "";
    beforeAll(async () => {
        server = await createFakeServer(
            normalizeFakeServerConfig({
                schemaFilePath: "./api/api.graphqls",
                defaultValues: {
                    CustomScalar: {
                        DATE_YYYYMMDD: `"2022-01-01"`,
                    },
                },
                ports: {
                    fakeServer: 4000,
                    apolloServer: 4002,
                },
                logLevel: "debug",
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
            const client = new ApolloClient({
                link: new HttpLink({
                    uri: `${fakeServerUrl}/graphql`,
                    fetch,
                }),
                cache: new InMemoryCache(),
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
                  "id": "xxxx-xxxx-xxxx-xxxx_g2341_d2_c2",
                  "name": "string",
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
                            "id": "author-id_g975_d3_c364",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                        {
                          "author": {
                            "id": "author-id_g1055_d3_c404",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                        {
                          "author": {
                            "id": "author-id_g1135_d3_c444",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                      ],
                      "id": "author-id_g973_d1_c363",
                      "name": "F. Scott Fitzgerald",
                    },
                    {
                      "age": 33,
                      "books": [
                        {
                          "author": {
                            "id": "author-id_g1216_d3_c485",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                        {
                          "author": {
                            "id": "author-id_g1296_d3_c525",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                        {
                          "author": {
                            "id": "author-id_g1376_d3_c565",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                      ],
                      "id": "author-id_g1214_d1_c484",
                      "name": "F. Scott Fitzgerald",
                    },
                    {
                      "age": 33,
                      "books": [
                        {
                          "author": {
                            "id": "author-id_g1457_d3_c606",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                        {
                          "author": {
                            "id": "author-id_g1537_d3_c646",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                        {
                          "author": {
                            "id": "author-id_g1617_d3_c686",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                      ],
                      "id": "author-id_g1455_d1_c605",
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
            const client = new ApolloClient({
                link: new HttpLink({
                    uri: `${fakeServerUrl}/graphql`,
                    headers: {
                        "sequence-id": sequenceId,
                    },
                    fetch,
                }),
                cache: new InMemoryCache(),
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
            const client = new ApolloClient({
                link: new HttpLink({
                    uri: `${fakeServerUrl}/graphql`,
                    headers: {
                        "sequence-id": sequenceId,
                    },
                    fetch,
                }),
                cache: new InMemoryCache(),
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
            const client = new ApolloClient({
                link: ApolloLink.from([
                    errorLink,
                    new HttpLink({
                        uri: `${fakeServerUrl}/graphql`,
                        headers: {
                            "sequence-id": sequenceId,
                        },
                        fetch,
                    }),
                ]),
                cache: new InMemoryCache(),
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
            const spy = vi.fn();
            const _errorLink = apolloOnError(spy);
            // request to server
            const client = new ApolloClient({
                link: ApolloLink.from([
                    new HttpLink({
                        uri: `${fakeServerUrl}/graphql`,
                        headers: {
                            "sequence-id": sequenceId,
                        },
                        fetch,
                    }),
                ]),
                cache: new InMemoryCache(),
            });
            const response = await client.query({
                query: GetDogDocument,
            });
            expect(response.data).toMatchInlineSnapshot(`
        {
          "dog": {
            "__typename": "Dog",
            "id": "dog id",
            "name": "dog name",
          },
        }
      `);
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
                  "id": "xxxx-xxxx-xxxx-xxxx_g2342_d1_c1",
                  "name": "string",
                },
              }
            `);
        });
    });

    describe("Conditional Fake", () => {
        it("should handle count-based conditions", async () => {
            const sequenceId = crypto.randomUUID();
            const client = new GraphQLClient(`${fakeServerUrl}/graphql`, {
                headers: {
                    "sequence-id": sequenceId,
                },
            });

            // Register fake for 1st call
            await fetch(`${fakeServerUrl}/fake`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    type: "operation",
                    operationName: "GetBooks",
                    condition: { type: "count", value: 1 },
                    data: {
                        books: [{ id: "book-1", title: "First Call Book" }],
                    },
                }),
            });

            // Register fake for 2nd call
            await fetch(`${fakeServerUrl}/fake`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    type: "operation",
                    operationName: "GetBooks",
                    condition: { type: "count", value: 2 },
                    data: {
                        books: [{ id: "book-2", title: "Second Call Book" }],
                    },
                }),
            });

            // First call should return "First Call Book"
            const firstResponse = await client.request(GetBooksDocument);
            expect((firstResponse as any).books[0].title).toBe("First Call Book");

            // Second call should return "Second Call Book"
            const secondResponse = await client.request(GetBooksDocument);
            expect((secondResponse as any).books[0].title).toBe("Second Call Book");
        });

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
                    condition: {
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
                    condition: {
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
            expect((firstResponse as any).createBook.title).toBe("Test Book A - Created");

            // Call with second input
            const secondResponse = await client.request(CreateBookDocument, {
                input: {
                    title: "Test Book B",
                    authorId: "author-2",
                },
            });
            expect((secondResponse as any).createBook.title).toBe("Test Book B - Created");
        });
    });
});
