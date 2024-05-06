import { createFakeServer } from "@newmo/graphql-fake-server";
import { GraphQLClient, gql } from "graphql-request";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GetBooksDocument } from "./generated/graphql.js";
import {
    registerCreateBookMutationResponse,
    registerGetBooksQueryErrorResponse,
    registerGetBooksQueryResponse,
} from "./generated/register-operation.js";

describe("integration test", async () => {
    let closeServer: () => void;
    beforeAll(async () => {
        const server = await createFakeServer({
            schemaFilePath: "./api/api.graphqls",
            logLevel: "info",
        });
        await server.start();
        closeServer = server.stop;
    });
    afterAll(() => {
        closeServer?.();
    });
    it("request to server and get response", async () => {
        const response = await fetch("http://localhost:4000/graphql", {
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
        const client = new GraphQLClient("http://localhost:4000/graphql", {
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
        const client = new GraphQLClient("http://localhost:4000/graphql", {
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
    it("register fake error response for query", async () => {
        const sequenceId = crypto.randomUUID();
        // register fake error response for GetBooks query
        const resRegister = await registerGetBooksQueryErrorResponse(sequenceId, {
            errors: [{ message: "fake error message" }],
            responseStatusCode: 400,
        });
        expect(resRegister).toMatchInlineSnapshot(`"{"ok":true}"`);
        // request to server
        const client = new GraphQLClient("http://localhost:4000/graphql", {
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
