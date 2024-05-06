import { extendSchema } from "@newmo/graphql-fake-core";
import { buildSchema } from "graphql/utilities/index.js";
import { describe, expect, it } from "vitest";
import { createMock } from "./createMock.js";
import { type RegisterSequenceNetworkError, createFakeServerInternal } from "./server.js";

let portCounter = 0;
const getPorts = () => {
    portCounter += 2;
    return {
        fakeServer: 4000 + portCounter,
        apolloServer: 4001 + portCounter,
    };
};
const startTestFakeServer = async ({
                                       schemaString,
                                       ports,
                                   }: { schemaString: string; ports: ReturnType<typeof getPorts> }) => {
    const schema = buildSchema(extendSchema(schemaString));
    const logLevel = "info";
    const mockObject = await createMock({
        schema,
        logLevel,
        maxFieldRecursionDepth: 3,
    });
    return createFakeServerInternal({
        schema,
        mockObject,
        logLevel,
        ports: ports,
        maxDepth: 3,
        maxFieldRecursionDepth: 4,
        maxRegisteredSequences: 100,
    });
};
describe("graphql-fake-server", () => {
    it("should response fake graphql server", async () => {
        const schema = `
            enum BookGenre {
                FICTION
                NON_FICTION
            }
            type Book {
                id: ID! @exampleID(value: "book-id")
                title: String! @exampleString(value: "The Great Gatsby")
                genre: BookGenre! @exampleString(value: "FICTION")
            }
            type Author {
                id: ID! @exampleID(value: "author-id")
                name: String! @exampleString(value: "F. Scott Fitzgerald")
                age: Int! @exampleInt(value: 33)
                books: [Book!]!
            }
            type Query {
                authors: [Author!]!
            }
        `;
        const ports = getPorts();
        const server = await startTestFakeServer({ schemaString: schema, ports });
        await server.start();
        const sequenceId = crypto.randomUUID();
        const response = await fetch(`http://localhost:${ports.fakeServer}/graphql`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "sequence-id": sequenceId,
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
                          id
                          title
                          genre
                        }
                      }
                    }
                `,
            }),
        });
        const result = await response.json();
        expect(result).toMatchInlineSnapshot(`
          {
            "data": {
              "authors": [
                {
                  "age": 33,
                  "books": [
                    {
                      "genre": "FICTION",
                      "id": "book-id24",
                      "title": "The Great Gatsby",
                    },
                    {
                      "genre": "FICTION",
                      "id": "book-id25",
                      "title": "The Great Gatsby",
                    },
                    {
                      "genre": "FICTION",
                      "id": "book-id26",
                      "title": "The Great Gatsby",
                    },
                  ],
                  "id": "author-id11",
                  "name": "F. Scott Fitzgerald",
                },
                {
                  "age": 33,
                  "books": [
                    {
                      "genre": "FICTION",
                      "id": "book-id27",
                      "title": "The Great Gatsby",
                    },
                    {
                      "genre": "FICTION",
                      "id": "book-id28",
                      "title": "The Great Gatsby",
                    },
                    {
                      "genre": "FICTION",
                      "id": "book-id29",
                      "title": "The Great Gatsby",
                    },
                  ],
                  "id": "author-id12",
                  "name": "F. Scott Fitzgerald",
                },
                {
                  "age": 33,
                  "books": [
                    {
                      "genre": "FICTION",
                      "id": "book-id210",
                      "title": "The Great Gatsby",
                    },
                    {
                      "genre": "FICTION",
                      "id": "book-id211",
                      "title": "The Great Gatsby",
                    },
                    {
                      "genre": "FICTION",
                      "id": "book-id212",
                      "title": "The Great Gatsby",
                    },
                  ],
                  "id": "author-id13",
                  "name": "F. Scott Fitzgerald",
                },
              ],
            },
          }
        `);
    });
    it("should return registered fake response", async () => {
        const schema = `
            enum BookGenre {
                FICTION
                NON_FICTION
            }
            type Book {
                id: ID! @exampleID(value: "book-id")
                title: String! @exampleString(value: "The Great Gatsby")
                genre: BookGenre! @exampleString(value: "FICTION")
            }
            type Author {
                id: ID! @exampleID(value: "author-id")
                name: String! @exampleString(value: "F. Scott Fitzgerald")
                age: Int! @exampleInt(value: 33)
                books: [Book!]!
            }
            type Query {
                authors: [Author!]!
            }
        `;
        const ports = getPorts();
        const server = await startTestFakeServer({ schemaString: schema, ports });
        const { urls } = await server.start();
        const sequenceId = crypto.randomUUID();
        // register seed
        await fetch(`${urls.fakeServer}/register-operation`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "sequence-id": sequenceId,
            },
            body: JSON.stringify({
                type: "operation",
                operationName: "GetAuthors",
                data: {
                    authors: [
                        {
                            id: "override-author-id",
                            name: "F. Scott Fitzgerald",
                            age: 33,
                            books: [
                                {
                                    id: "book-id1",
                                    title: "The Great Gatsby",
                                    genre: "FICTION",
                                },
                            ],
                        },
                    ],
                },
            }),
        });
        //request with sequence-id
        const response = await fetch(`${urls.fakeServer}/graphql`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "sequence-id": sequenceId,
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
                          id
                          title
                          genre
                        }
                      }
                    }
                `,
            }),
        });
        const result = await response.json();
        expect(result).toMatchInlineSnapshot(`
          {
            "data": {
              "authors": [
                {
                  "age": 33,
                  "books": [
                    {
                      "genre": "FICTION",
                      "id": "book-id1",
                      "title": "The Great Gatsby",
                    },
                  ],
                  "id": "override-author-id",
                  "name": "F. Scott Fitzgerald",
                },
              ],
            },
          }
        `);
    });
    it("should support mutation", async () => {
        const schema = `
            type Book {
                id: ID! @exampleID(value: "book-id")
                title: String! @exampleString(value: "The Great Gatsby")
            }
            type Query {
                books: [Book!]!
            }
            
            type Mutation {
                createBook(title: String!): Book!
            }
        `;
        const ports = getPorts();
        const server = await startTestFakeServer({ schemaString: schema, ports });
        const { urls } = await server.start();
        const sequenceId = crypto.randomUUID();
        await fetch(`${urls.fakeServer}/register-operation`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "sequence-id": sequenceId,
            },
            body: JSON.stringify({
                type: "operation",
                operationName: "CreateBook",
                data: {
                    createBook: {
                        id: "new-id",
                        title: "new BOOK",
                    },
                },
            }),
        });
        // mutation request
        const response = await fetch(`${urls.fakeServer}/graphql`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "sequence-id": sequenceId,
            },
            body: JSON.stringify({
                operationName: "CreateBook",
                query: `
                    mutation CreateBook($title: String!) {
                      createBook(title: $title) {
                        id
                        title
                      }
                    }
                `,
                variables: {
                    title: "The Great Gatsby",
                },
            }),
        });
        const result = await response.json();
        expect(result).toMatchInlineSnapshot(`
          {
            "data": {
              "createBook": {
                "id": "new-id",
                "title": "new BOOK",
              },
            },
          }
        `);
    });
    it("should support network-error operation", async () => {
        const schema = `
            type Book {
                id: ID! @exampleID(value: "book-id")
                title: String! @exampleString(value: "The Great Gatsby")
            }
            type Query {
                books: [Book!]!
            }
        `;
        const ports = getPorts();
        const server = await startTestFakeServer({ schemaString: schema, ports });
        const { urls } = await server.start();
        const sequenceId = crypto.randomUUID();
        // register network-error operation
        const regiRes = await fetch(`${urls.fakeServer}/register-operation`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "sequence-id": sequenceId,
            },
            body: JSON.stringify({
                type: "network-error",
                operationName: "GetBooks",
                errors: [
                    {
                        message: "Network Error",
                    },
                ],
                responseStatusCode: 400,
            } as RegisterSequenceNetworkError),
        });
        expect(regiRes.status).toBe(200);
        // request with sequence-id
        const response = await fetch(`${urls.fakeServer}/graphql`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "sequence-id": sequenceId,
            },
            body: JSON.stringify({
                operationName: "GetBooks",
                query: `
                    query GetBooks {
                      books {
                        id
                        title
                      }
                    }
                `,
            }),
        });
        expect(response.status).toBe(400);
        const result = await response.json();
        expect(result).toMatchInlineSnapshot(`
          [
            {
              "message": "Network Error",
            },
          ]
        `);
    });
});
