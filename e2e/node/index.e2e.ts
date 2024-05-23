import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client/core";
import { loadDevMessages, loadErrorMessages } from "@apollo/client/dev";
import { createFakeServer } from "@newmo/graphql-fake-server";
import { GraphQLClient } from "graphql-request";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    registerCreateBookMutationResponse,
    registerGetBookWithFragmentsQueryResponse,
    registerGetBooksQueryErrorResponse,
    registerGetBooksQueryResponse,
    registerGetDogQueryResponse,
    registerGotUnionUserQueryResponse,
    registerUseMutationErrorPatternMutationMutationResponse,
} from "./generated/fake.js";
import type { FragmentType } from "./generated/fragment-masking.js";
import {
    AbcErrorCode,
    type BookFragmentPartsFragment,
    CreateBookDocument,
    type CreateBookInput,
    GetBookWithFragmentsDocument,
    GetBooksDocument,
    GetDogDocument,
    GetUserNamesArrayExampleDocument,
    GotUnionUserDocument,
    UseMutationErrorPatternMutationDocument,
    type UseMutationErrorPatternMutationMutation,
} from "./generated/graphql.js";

loadDevMessages();
loadErrorMessages();

describe("integration test", async () => {
    let server: Awaited<ReturnType<typeof createFakeServer>>;
    let fakeServerUrl = "";
    beforeAll(async () => {
        server = await createFakeServer({
            schemaFilePath: "./api/api.graphqls",
            logLevel: "debug",
        });
        const { urls } = await server.start();
        fakeServerUrl = urls.fakeServer;
    });
    afterAll(() => {
        server?.stop();
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
                        "id": "author-id313",
                      },
                      "genre": "FICTION",
                      "title": "The Great Gatsby",
                    },
                    {
                      "author": {
                        "id": "author-id314",
                      },
                      "genre": "FICTION",
                      "title": "The Great Gatsby",
                    },
                    {
                      "author": {
                        "id": "author-id315",
                      },
                      "genre": "FICTION",
                      "title": "The Great Gatsby",
                    },
                  ],
                  "id": "author-id112",
                  "name": "F. Scott Fitzgerald",
                },
                {
                  "age": 33,
                  "books": [
                    {
                      "author": {
                        "id": "author-id317",
                      },
                      "genre": "FICTION",
                      "title": "The Great Gatsby",
                    },
                    {
                      "author": {
                        "id": "author-id318",
                      },
                      "genre": "FICTION",
                      "title": "The Great Gatsby",
                    },
                    {
                      "author": {
                        "id": "author-id319",
                      },
                      "genre": "FICTION",
                      "title": "The Great Gatsby",
                    },
                  ],
                  "id": "author-id116",
                  "name": "F. Scott Fitzgerald",
                },
                {
                  "age": 33,
                  "books": [
                    {
                      "author": {
                        "id": "author-id321",
                      },
                      "genre": "FICTION",
                      "title": "The Great Gatsby",
                    },
                    {
                      "author": {
                        "id": "author-id322",
                      },
                      "genre": "FICTION",
                      "title": "The Great Gatsby",
                    },
                    {
                      "author": {
                        "id": "author-id323",
                      },
                      "genre": "FICTION",
                      "title": "The Great Gatsby",
                    },
                  ],
                  "id": "author-id120",
                  "name": "F. Scott Fitzgerald",
                },
              ],
            },
          }
        `);
        });
    });
    describe("/fake", () => {
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
            // get fake response
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
        it("register fake response for query Dog which is implemented an interface", async () => {
            const sequenceId = crypto.randomUUID();
            const resRegister = await registerGetDogQueryResponse(sequenceId, {
                dog: {
                    id: "dog id",
                    name: "dog name",
                },
            });
            expect(resRegister).toMatchInlineSnapshot(`"{"ok":true}"`);
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
            "dog": {
              "id": "dog id",
              "name": "dog name",
            },
          }
        `);
        });
        it("register fake response for mutation", async () => {
            const sequenceId = crypto.randomUUID();
            // register fake response for mutation
            const resRegister = await registerCreateBookMutationResponse(sequenceId, {
                createBook: {
                    id: "new id",
                    title: "new title",
                },
            });
            expect(resRegister).toMatchInlineSnapshot(`"{"ok":true}"`);
            // request to server
            // const client = new GraphQLClient(`${fakeServerUrl}/graphql`, {
            //     headers: {
            //         "sequence-id": sequenceId,
            //     },
            // });
            // get fake response
            // const mutation = gql`
            //     mutation  CreateBook {
            //         createBook(input: { title: "new title" }) {
            //             id
            //             title
            //         }
            //     }
            // `;

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
            const response = await client.mutate<CreateBookInput>({
                mutation: CreateBookDocument,
                variables: {
                    title: "new title",
                },
            });
            expect(response.data).toMatchInlineSnapshot(`
          {
            "createBook": {
              "id": "new id",
              "title": "new title",
            },
          }
        `);
        });
        it("register fake data for union type", async () => {
            const sequenceId = crypto.randomUUID();
            const resRegister = await registerGotUnionUserQueryResponse(sequenceId, {
                unionUser: {
                    __typename: "User",
                    id: "student id",
                    name: "student name",
                },
            });
            expect(resRegister).toMatchInlineSnapshot(`"{"ok":true}"`);
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
            "unionUser": {
              "__typename": "User",
              "id": "student id",
              "name": "student name",
            },
          }
        `);
        });
        it("register fake response which use Fragment", async () => {
            const sequenceId = crypto.randomUUID();
            // register fake response for mutation
            const resRegister = await registerGetBookWithFragmentsQueryResponse(sequenceId, {
                book: {
                    id: "new id",
                    title: "new title",
                } as FragmentType<BookFragmentPartsFragment>,
            });
            expect(resRegister).toMatchInlineSnapshot(`"{"ok":true}"`);
            // request to server
            const client = new GraphQLClient(`${fakeServerUrl}/graphql`, {
                headers: {
                    "sequence-id": sequenceId,
                },
            });
            const response = await client.request(GetBookWithFragmentsDocument);
            expect(response).toMatchInlineSnapshot(`
          {
            "book": {
              "id": "new id",
              "title": "new title",
            },
          }
        `);
        });

        it("register fake error response for query", async () => {
            const sequenceId = crypto.randomUUID();
            // register fake error response for GetBooks query
            const resRegister = await registerGetBooksQueryErrorResponse(sequenceId, {
                errors: [{ message: "fake error message" }],
                responseStatusCode: 400,
            });
            expect(resRegister).toMatchInlineSnapshot(`"{"ok":true}"`);
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
                    `[Error: GraphQL Error (Code: 400): {"response":{"error":"[{\\"message\\":\\"fake error message\\"}]","status":400,"headers":{}},"request":{"query":"query GetBooks {\\n  books {\\n    id\\n    title\\n  }\\n}"}}]`,
                );
            }
        });
        it("register fake response for mutation errors pattern", async () => {
            const sequenceId = crypto.randomUUID();
            // register fake response for UseFooBarMutationMutation mutation
            const resRegister = await registerUseMutationErrorPatternMutationMutationResponse(
                sequenceId,
                {
                    useMutationErrorPattern: {
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
                  "useMutationErrorPattern": {
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
            expect(response).toMatchInlineSnapshot(`{
                "userWithErrors": {
                  "errors": [],
                  "id": "xxxx-xxxx-xxxx-xxxx11",
                  "name": "string",
                },
              }
            `);
        });
    });
});
