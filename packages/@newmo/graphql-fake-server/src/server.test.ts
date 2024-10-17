import assert from "node:assert";
import { createMock, extendSchema } from "@newmo/graphql-fake-core";
import { buildSchema } from "graphql/utilities/index.js";
import { describe, expect, it } from "vitest";
import {
    type CalledResultResponse,
    type RegisterSequenceNetworkError,
    createFakeServerInternal,
} from "./server.js";

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
    const mockResult = await createMock({
        schema,
        maxFieldRecursionDepth: 3,
    });
    if (!mockResult.ok) {
        throw new Error("Failed to create mock server.", {
            cause: mockResult.error,
        });
    }
    console.log("mockResult.mock", JSON.stringify(mockResult.mock, null, 2));
    return createFakeServerInternal({
        schema,
        mockObject: mockResult.mock,
        logLevel,
        ports: ports,
        maxQueryDepth: 3,
        maxFieldRecursionDepth: 4,
        maxRegisteredSequences: 100,
    });
};
describe("graphql-fake-server", () => {
    describe("/fake", () => {
        it("should fake response from graphql server", async () => {
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
        it("should return second registered fake response when registered twice", async () => {
            const schema = `
            type Dog {
                id: ID! @exampleID(value: "dog-id")
                name: String! @exampleString(value: "hanako")
            }
            type Query {
                dog: Dog!
            }
        `;
            const ports = getPorts();
            const server = await startTestFakeServer({ schemaString: schema, ports });
            const { urls } = await server.start();
            const sequenceId = crypto.randomUUID();
            // first register - this will be ignored
            await fetch(`${urls.fakeServer}/fake`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    type: "operation",
                    operationName: "GetDog",
                    data: {
                        dog: {
                            id: "dog-1",
                            name: "hanako 1",
                        },
                    },
                }),
            });
            // second register - this will be used
            await fetch(`${urls.fakeServer}/fake`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    type: "operation",
                    operationName: "GetDog",
                    data: {
                        dog: {
                            id: "dog-2",
                            name: "taro 2",
                        },
                    },
                }),
            });
            const response = await fetch(`${urls.fakeServer}/graphql`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    operationName: "GetDog",
                    query: `
                    query GetDog {
                        dog {
                            id
                            name
                        }
                    }
                `,
                }),
            });
            const result = await response.json();
            expect(result).toMatchInlineSnapshot(`
          {
            "data": {
              "dog": {
                "id": "dog-2",
                "name": "taro 2",
              },
            },
          }
        `);
        });
        // register fake key is sequence-id x operationName
        it("should return registered fake response when register difference operation at same time", async () => {
            const schema = `
            type Dog {
                id: ID! @exampleID(value: "dog-id")
                name: String! @exampleString(value: "hanako")
            }
            type Query {
                dog: Dog!
            }
        `;
            const ports = getPorts();
            const server = await startTestFakeServer({ schemaString: schema, ports });
            const { urls } = await server.start();
            const sequenceId = crypto.randomUUID();
            // first register
            await fetch(`${urls.fakeServer}/fake`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    type: "operation",
                    operationName: "GetDogFirst",
                    data: {
                        dog: {
                            id: "dog-first",
                            name: "dog first",
                        },
                    },
                }),
            });
            // second register
            await fetch(`${urls.fakeServer}/fake`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    type: "operation",
                    operationName: "GetDogSecond",
                    data: {
                        dog: {
                            id: "dog-second",
                            name: "dog second",
                        },
                    },
                }),
            });
            // request for first register
            const firstResponse = await fetch(`${urls.fakeServer}/graphql`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    operationName: "GetDogFirst",
                    query: `
                    query GetDogFirst {
                        dog {
                            id
                            name
                        }
                    }
                `,
                }),
            });
            const firstResult = await firstResponse.json();
            expect(firstResult).toMatchInlineSnapshot(`
          {
            "data": {
              "dog": {
                "id": "dog-first",
                "name": "dog first",
              },
            },
          }
        `);
            // request for second register
            const secondResponse = await fetch(`${urls.fakeServer}/graphql`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    operationName: "GetDogSecond",
                    query: `
                    query GetDogSecond {
                        dog {
                            id
                            name
                        }
                    }
                `,
                }),
            });
            const secondResult = await secondResponse.json();
            expect(secondResult).toMatchInlineSnapshot(`
          {
            "data": {
              "dog": {
                "id": "dog-second",
                "name": "dog second",
              },
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
            await fetch(`${urls.fakeServer}/fake`, {
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
            await fetch(`${urls.fakeServer}/fake`, {
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
            const regiRes = await fetch(`${urls.fakeServer}/fake`, {
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
          {
            "errors": [
              {
                "message": "Network Error",
              },
            ],
          }
        `);
        });
        it("should support CORS request", async () => {
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
            const regiRes = await fetch(`${urls.fakeServer}/fake`, {
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
            // response header should have Access-Control-Allow-Origin
            expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
        });
        it("should return namingConvention response", async () => {
            const schema = `
                interface Error {
                  message: String!
                }
                input FooURLInput {
                    "Foo URL"
                    URL: String!
                }
                type FooURLPayload {
                    "Foo URL"
                    URL: String!
                    "Errors"
                    errors: [CreateFooURLError!]!
                }
                union CreateFooURLError = CreateFooURLErrorDetail
                type CreateFooURLErrorDetail implements Error {
                  code: CreateFooURLErrorCode!
                  message: String!
                }
                enum CreateFooURLErrorCode {
                  FAILED_TO_CREATE_FOO_URL
                }
                type Mutation {
                    createFooURL(input: FooURLInput!): FooURLPayload!
                }
                type Query {
                    fooURLs: [FooURLPayload!]!
                }
                `;
            const ports = getPorts();
            const server = await startTestFakeServer({
                schemaString: schema,
                ports,
            });
            const { urls } = await server.start();
            // request without sequence-id
            const response = await fetch(`${urls.fakeServer}/graphql`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    operationName: "CreateFooURL",
                    query: `
                    mutation CreateFooURL($input: FooURLInput!) {
                      createFooURL(input: $input) {
                        URL
                        errors {
                          ... on CreateFooURLErrorDetail {
                            message
                          }
                        }
                      }
                    }
                `,
                    variables: {
                        input: {
                            URL: "http://example.com",
                        },
                    },
                }),
            });
            const result = await response.json();
            expect(result).toMatchInlineSnapshot(`
          {
            "data": {
              "createFooURL": {
                "URL": "string",
                "errors": [
                  {
                    "message": "string",
                  },
                  {
                    "message": "string",
                  },
                  {
                    "message": "string",
                  },
                ],
              },
            },
          }
        `);
        });
    });
    describe("/fake/called", () => {
        it("should return called operations for query", async () => {
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
            // get {request,response} from /fake/called
            const calledResponse = await fetch(`${urls.fakeServer}/fake/called`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    operationName: "GetAuthors",
                }),
            });
            const calledResult = (await calledResponse.json()) as CalledResultResponse;
            expect(calledResult.ok).toBeTruthy();
            expect(calledResult.data.length).toBe(1);
            assert(calledResult.data[0]);
            expect(calledResult.data[0].requestTimestamp).toBeGreaterThan(0);
            expect(calledResult.data[0].request.body).toMatchInlineSnapshot(`
              {
                "operationName": "GetAuthors",
                "query": "
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
                              ",
              }
            `);
            expect(calledResult.data[0].response.body).toMatchInlineSnapshot(`
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
        it("should return called operations for mutation", async () => {
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
            await fetch(`${urls.fakeServer}/fake`, {
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
            await fetch(`${urls.fakeServer}/graphql`, {
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
            // get {request,response} from /fake/called
            const calledResponse = await fetch(`${urls.fakeServer}/fake/called`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    operationName: "CreateBook",
                }),
            });
            const calledResult = (await calledResponse.json()) as CalledResultResponse;
            expect(calledResult.ok).toBeTruthy();
            expect(calledResult.data.length).toBe(1);
            assert(calledResult.data[0]);
            expect(calledResult.data[0].requestTimestamp).toBeGreaterThan(0);
            expect(calledResult.data[0].request.body).toMatchInlineSnapshot(`
              {
                "operationName": "CreateBook",
                "query": "
                                  mutation CreateBook($title: String!) {
                                    createBook(title: $title) {
                                      id
                                      title
                                    }
                                  }
                              ",
                "variables": {
                  "title": "The Great Gatsby",
                },
              }
            `);
            expect(calledResult.data[0].response.body).toMatchInlineSnapshot(`
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
        it("support multiple called operations", async () => {
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
            // register seed
            await fetch(`${urls.fakeServer}/fake`, {
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
            // 1. first request
            await fetch(`${urls.fakeServer}/graphql`, {
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
                        title: "1111",
                    },
                }),
            });
            // 2. second request
            await fetch(`${urls.fakeServer}/graphql`, {
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
                        title: "2222",
                    },
                }),
            });
            const calledResponse = await fetch(`${urls.fakeServer}/fake/called`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    operationName: "CreateBook",
                }),
            });
            const calledResult = (await calledResponse.json()) as CalledResultResponse;
            expect(calledResult.ok).toBeTruthy();
            expect(calledResult.data.length).toBe(2);
            assert(calledResult.data[0]);
            assert(calledResult.data[1]);
            expect(calledResult.data[0].request.body.variables).toEqual({ title: "1111" });
            expect(calledResult.data[1].request.body.variables).toEqual({ title: "2222" });
        });
    });
});
