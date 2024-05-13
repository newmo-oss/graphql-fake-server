import { createFakeServer } from "@newmo/graphql-fake-server";
import { GraphQLClient, gql } from "graphql-request";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    registerCreateBookMutationResponse,
    registerGetBookWithFragmentsQueryResponse,
    registerGetBooksQueryErrorResponse,
    registerGetBooksQueryResponse,
    registerGetDogQueryResponse,
    registerGotUnionUserQueryResponse,
} from "./generated/fake.js";
import { type FragmentType, getFragmentData } from "./generated/fragment-masking.js";
import {
    type BookFragmentPartsFragment,
    BookFragmentPartsFragmentDoc,
    CreateBookDocument,
    GetBookWithFragmentsDocument,
    GetBooksDocument,
    GetDogDocument,
    GotUnionUserDocument,
} from "./generated/graphql.js";

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
        const client = new GraphQLClient(`${fakeServerUrl}/graphql`, {
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
        const client = new GraphQLClient(`${fakeServerUrl}/graphql`, {
            headers: {
                "sequence-id": sequenceId,
            },
        });
        // get fake response
        const mutation = gql`
            mutation  CreateBook {
                createBook(input: { title: "new title" }) {
                    id
                    title
                }
            }
        `;
        const response = await client.request(mutation);
        expect(response).toMatchInlineSnapshot(`
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
    it("register fake response which use Fragement", async () => {
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
});
