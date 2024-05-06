import { describe, expect, it } from "vitest";
import { extendSchema } from "@newmo/graphql-fake-core";
import { createFakeServerInternal } from "./server.js";
import { buildSchema } from "graphql/utilities/index.js";
import { createMock } from "./createMock.js";

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
    const mockObject = await createMock({
        schema,
        logLevel: "info",
        maxFieldRecursionDepth: 3,
    });
    return createFakeServerInternal({
        schema,
        mockObject,
        logLevel: "info",
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
        const response = await fetch(`http://localhost:${ports.fakeServer}/graphql`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "sequence-id": "test-sequence-id",
            },
            body: JSON.stringify({
                query: `
                    query {
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
        await server.start();
        // register seed
        await fetch(`http://localhost:${ports.fakeServer}/register-operation`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "sequence-id": "test-sequence-id",
            },
            body: JSON.stringify({
                operationName: "authors",
                type: "operation",
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
        const response = await fetch(`http://localhost:${ports.fakeServer}/graphql`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "sequence-id": "test-sequence-id",
            },
            body: JSON.stringify({
                query: `
                    query {
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
          }
        `);
    });
});
