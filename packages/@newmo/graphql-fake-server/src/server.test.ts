import assert from "node:assert";
import { createMock, extendSchema } from "@newmo/graphql-fake-core";
import { buildSchema } from "graphql/utilities/index.js";
import { describe, expect, it } from "vitest";
import {
    type CalledResultResponse,
    type ConditionRule,
    createFakeServerInternal,
    type RegisterSequenceNetworkError,
    type RegisterSequenceOptions,
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
    allowedCORSOrigins,
}: {
    schemaString: string;
    ports: ReturnType<typeof getPorts>;
    allowedCORSOrigins?: string[];
}) => {
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
    return createFakeServerInternal({
        schema,
        mockObject: mockResult.mock,
        logLevel,
        ports: ports,
        maxQueryDepth: 3,
        maxFieldRecursionDepth: 4,
        maxRegisteredSequences: 100,
        allowedCORSOrigins: allowedCORSOrigins ?? [],
    });
};
describe("graphql-fake-server", () => {
    describe("ApolloServer", () => {
        it("should not deny CORS request from outer", async () => {
            const schema = `
              type Query {
                  hello: String!
              }
          `;
            const ports = getPorts();
            const server = await startTestFakeServer({ schemaString: schema, ports });
            const { urls } = await server.start();
            const response = await fetch(`${urls.apolloServer}/query`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Origin: "https://example.com",
                },
                body: JSON.stringify({
                    operationName: "Hello",
                    query: `
                      query Hello {
                          hello
                      }
                  `,
                }),
            });
            expect(await response.text()).includes("Not allowed by CORS");
            expect(response.status).toBe(500);
        });
    });
    describe("CORS", () => {
        it("should not deny CORS request from outer by default", async () => {
            const schema = `
              type Query {
                  hello: String!
              }
          `;
            const ports = getPorts();
            const server = await startTestFakeServer({ schemaString: schema, ports });
            const { urls } = await server.start();
            const response = await fetch(`${urls.apolloServer}/query`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Origin: "https://example.com",
                },
                body: JSON.stringify({
                    operationName: "Hello",
                    query: `
                      query Hello {
                          hello
                      }
                  `,
                }),
            });
            expect(await response.text()).includes("Not allowed by CORS");
            expect(response.status).toBe(500);
        });
        it("should allow CORS request from outer when allowed", async () => {
            const schema = `
              type Query {
                  hello: String!
              }
          `;
            const ports = getPorts();
            const server = await startTestFakeServer({
                schemaString: schema,
                ports,
                allowedCORSOrigins: ["https://example.test"],
            });
            const { urls } = await server.start();
            const response = await fetch(`${urls.apolloServer}/query`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Origin: "https://example.test",
                },
                body: JSON.stringify({
                    operationName: "Hello",
                    query: `
                      query Hello {
                          hello
                      }
                  `,
                }),
            });
            expect(await response.text()).not.toMatch("Not allowed by CORS");
            expect(response.status).toBe(200);
        });
    });
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
                          "id": "book-id_g6_d2_c4",
                          "title": "The Great Gatsby",
                        },
                        {
                          "genre": "FICTION",
                          "id": "book-id_g7_d2_c5",
                          "title": "The Great Gatsby",
                        },
                        {
                          "genre": "FICTION",
                          "id": "book-id_g8_d2_c6",
                          "title": "The Great Gatsby",
                        },
                      ],
                      "id": "author-id_g5_d1_c1",
                      "name": "F. Scott Fitzgerald",
                    },
                    {
                      "age": 33,
                      "books": [
                        {
                          "genre": "FICTION",
                          "id": "book-id_g10_d2_c7",
                          "title": "The Great Gatsby",
                        },
                        {
                          "genre": "FICTION",
                          "id": "book-id_g11_d2_c8",
                          "title": "The Great Gatsby",
                        },
                        {
                          "genre": "FICTION",
                          "id": "book-id_g12_d2_c9",
                          "title": "The Great Gatsby",
                        },
                      ],
                      "id": "author-id_g9_d1_c2",
                      "name": "F. Scott Fitzgerald",
                    },
                    {
                      "age": 33,
                      "books": [
                        {
                          "genre": "FICTION",
                          "id": "book-id_g14_d2_c10",
                          "title": "The Great Gatsby",
                        },
                        {
                          "genre": "FICTION",
                          "id": "book-id_g15_d2_c11",
                          "title": "The Great Gatsby",
                        },
                        {
                          "genre": "FICTION",
                          "id": "book-id_g16_d2_c12",
                          "title": "The Great Gatsby",
                        },
                      ],
                      "id": "author-id_g13_d1_c3",
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
        it("should support CORS request from localhost", async () => {
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
                    Origin: "http://localhost:4000",
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
            expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
                "http://localhost:4000",
            );
        });
        it("should support CORS request from local ip", async () => {
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
                    Origin: "http://192.168.0.1:4000",
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
            expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
                "http://192.168.0.1:4000",
            );
        });
        it("should not support external CORS request", async () => {
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
                    Origin: "http://example.com",
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
            // response header should not have Access-Control-Allow-Origin
            expect(response.headers.get("Access-Control-Allow-Origin")).toBe(null);
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
            const _response = await fetch(`${urls.fakeServer}/graphql`, {
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
                          "id": "book-id_g6_d2_c4",
                          "title": "The Great Gatsby",
                        },
                        {
                          "genre": "FICTION",
                          "id": "book-id_g7_d2_c5",
                          "title": "The Great Gatsby",
                        },
                        {
                          "genre": "FICTION",
                          "id": "book-id_g8_d2_c6",
                          "title": "The Great Gatsby",
                        },
                      ],
                      "id": "author-id_g5_d1_c1",
                      "name": "F. Scott Fitzgerald",
                    },
                    {
                      "age": 33,
                      "books": [
                        {
                          "genre": "FICTION",
                          "id": "book-id_g10_d2_c7",
                          "title": "The Great Gatsby",
                        },
                        {
                          "genre": "FICTION",
                          "id": "book-id_g11_d2_c8",
                          "title": "The Great Gatsby",
                        },
                        {
                          "genre": "FICTION",
                          "id": "book-id_g12_d2_c9",
                          "title": "The Great Gatsby",
                        },
                      ],
                      "id": "author-id_g9_d1_c2",
                      "name": "F. Scott Fitzgerald",
                    },
                    {
                      "age": 33,
                      "books": [
                        {
                          "genre": "FICTION",
                          "id": "book-id_g14_d2_c10",
                          "title": "The Great Gatsby",
                        },
                        {
                          "genre": "FICTION",
                          "id": "book-id_g15_d2_c11",
                          "title": "The Great Gatsby",
                        },
                        {
                          "genre": "FICTION",
                          "id": "book-id_g16_d2_c12",
                          "title": "The Great Gatsby",
                        },
                      ],
                      "id": "author-id_g13_d1_c3",
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
            // Use bracket notation for properties from index signature
            expect(calledResult.data[0].request.body["variables"]).toEqual({
                title: "1111",
            });
            expect(calledResult.data[1].request.body["variables"]).toEqual({
                title: "2222",
            });
        });
    });
    describe("Conditional Fake", () => {
        describe("Count-based conditions", () => {
            it("should return different responses based on call count", async () => {
                const schema = `
                    type Book {
                        id: ID! @exampleID(value: "book-id")
                        title: String! @exampleString(value: "Default Book")
                    }
                    type Query {
                        books: [Book!]!
                    }
                `;
                const ports = getPorts();
                const server = await startTestFakeServer({
                    schemaString: schema,
                    ports,
                });
                const { urls } = await server.start();
                const sequenceId = crypto.randomUUID();

                // Register fake for 1st call
                const firstCallCondition: ConditionRule = { type: "count", value: 1 };
                const firstCallFake: RegisterSequenceOptions = {
                    type: "operation",
                    operationName: "GetBooks",
                    requestCondition: firstCallCondition,
                    data: {
                        books: [{ id: "book-1", title: "First Call Book" }],
                    },
                };

                await fetch(`${urls.fakeServer}/fake`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "sequence-id": sequenceId,
                    },
                    body: JSON.stringify(firstCallFake),
                });

                // Register fake for 2nd call
                const secondCallCondition: ConditionRule = { type: "count", value: 2 };
                const secondCallFake: RegisterSequenceOptions = {
                    type: "operation",
                    operationName: "GetBooks",
                    requestCondition: secondCallCondition,
                    data: {
                        books: [{ id: "book-2", title: "Second Call Book" }],
                    },
                };

                await fetch(`${urls.fakeServer}/fake`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "sequence-id": sequenceId,
                    },
                    body: JSON.stringify(secondCallFake),
                });

                // First call should return first fake
                const firstResponse = await fetch(`${urls.fakeServer}/query`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "sequence-id": sequenceId,
                    },
                    body: JSON.stringify({
                        query: `
                            query GetBooks {
                                books {
                                    id
                                    title
                                }
                            }
                        `,
                        operationName: "GetBooks",
                    }),
                });

                const firstResult = (await firstResponse.json()) as any;
                assert.ok(firstResult.data.books[0], "First book should exist");
                expect(firstResult.data.books[0].title).toBe("First Call Book");

                // Second call should return second fake
                const secondResponse = await fetch(`${urls.fakeServer}/query`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "sequence-id": sequenceId,
                    },
                    body: JSON.stringify({
                        query: `
                            query GetBooks {
                                books {
                                    id
                                    title
                                }
                            }
                        `,
                        operationName: "GetBooks",
                    }),
                });

                const secondResult = (await secondResponse.json()) as any;
                assert.ok(secondResult.data.books[0], "Second book should exist");
                expect(secondResult.data.books[0].title).toBe("Second Call Book");

                // Third call should fallback to declarative fake (no condition matches)
                const thirdResponse = await fetch(`${urls.fakeServer}/query`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "sequence-id": sequenceId,
                    },
                    body: JSON.stringify({
                        query: `
                            query GetBooks {
                                books {
                                    id
                                    title
                                }
                            }
                        `,
                        operationName: "GetBooks",
                    }),
                });

                const thirdResult = (await thirdResponse.json()) as any;
                assert.ok(thirdResult.data.books[0], "Third book should exist");
                expect(thirdResult.data.books[0].title).toBe("Default Book");
            });
        });

        describe("Variables-based conditions", () => {
            it("should return different responses based on variables", async () => {
                const schema = `
                    enum FileType {
                        A
                        B
                        C
                    }
                    input DownloadUrlsInput {
                        fileType: FileType!
                    }
                    type DownloadUrlsPayload {
                        urls: [String!]!
                    }
                    type DownloadUrlsResponse {
                        payload: DownloadUrlsPayload!
                    }
                    type Mutation {
                        downloadUrlsResponseToUploadedFiles(input: DownloadUrlsInput!): DownloadUrlsResponse!
                    }
                    type Query {
                        _dummy: String
                    }
                `;
                const ports = getPorts();
                const server = await startTestFakeServer({
                    schemaString: schema,
                    ports,
                });
                const { urls } = await server.start();
                const sequenceId = crypto.randomUUID();

                // Register fake for fileType: "A"
                const typeACondition: ConditionRule = {
                    type: "variables",
                    value: {
                        input: {
                            fileType: "A",
                        },
                    },
                };
                const typeAFake: RegisterSequenceOptions = {
                    type: "operation",
                    operationName: "downloadUrlsResponseToUploadedFiles",
                    requestCondition: typeACondition,
                    data: {
                        downloadUrlsResponseToUploadedFiles: {
                            payload: {
                                urls: ["https://example.com/file-a.pdf"],
                            },
                        },
                    },
                };

                await fetch(`${urls.fakeServer}/fake`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "sequence-id": sequenceId,
                    },
                    body: JSON.stringify(typeAFake),
                });

                // Register fake for fileType: "B"
                const typeBCondition: ConditionRule = {
                    type: "variables",
                    value: {
                        input: {
                            fileType: "B",
                        },
                    },
                };
                const typeBFake: RegisterSequenceOptions = {
                    type: "operation",
                    operationName: "downloadUrlsResponseToUploadedFiles",
                    requestCondition: typeBCondition,
                    data: {
                        downloadUrlsResponseToUploadedFiles: {
                            payload: {
                                urls: ["https://example.com/file-b.xlsx"],
                            },
                        },
                    },
                };

                await fetch(`${urls.fakeServer}/fake`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "sequence-id": sequenceId,
                    },
                    body: JSON.stringify(typeBFake),
                });

                // Request with fileType: "A"
                const responseA = await fetch(`${urls.fakeServer}/query`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "sequence-id": sequenceId,
                    },
                    body: JSON.stringify({
                        query: `
                            mutation downloadUrlsResponseToUploadedFiles($input: DownloadUrlsInput!) {
                                downloadUrlsResponseToUploadedFiles(input: $input) {
                                    payload {
                                        urls
                                    }
                                }
                            }
                        `,
                        operationName: "downloadUrlsResponseToUploadedFiles",
                        variables: {
                            input: {
                                fileType: "A",
                            },
                        },
                    }),
                });

                const resultA = (await responseA.json()) as any;
                assert.ok(
                    resultA.data.downloadUrlsResponseToUploadedFiles.payload.urls[0],
                    "First URL should exist",
                );
                expect(resultA.data.downloadUrlsResponseToUploadedFiles.payload.urls[0]).toBe(
                    "https://example.com/file-a.pdf",
                );

                // Request with fileType: "B"
                const responseB = await fetch(`${urls.fakeServer}/query`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "sequence-id": sequenceId,
                    },
                    body: JSON.stringify({
                        query: `
                            mutation downloadUrlsResponseToUploadedFiles($input: DownloadUrlsInput!) {
                                downloadUrlsResponseToUploadedFiles(input: $input) {
                                    payload {
                                        urls
                                    }
                                }
                            }
                        `,
                        operationName: "downloadUrlsResponseToUploadedFiles",
                        variables: {
                            input: {
                                fileType: "B",
                            },
                        },
                    }),
                });

                const resultB = (await responseB.json()) as any;
                assert.ok(
                    resultB.data.downloadUrlsResponseToUploadedFiles.payload.urls[0],
                    "Second URL should exist",
                );
                expect(resultB.data.downloadUrlsResponseToUploadedFiles.payload.urls[0]).toBe(
                    "https://example.com/file-b.xlsx",
                );
            });
        });

        describe("Condition conflicts", () => {
            it("should reject count condition when default fake is already registered", async () => {
                const schema = `
                    type User {
                        id: ID! @exampleID(value: "user-id")
                        name: String! @exampleString(value: "Default User")
                    }
                    type Query {
                        user(id: ID!): User!
                    }
                `;
                const ports = getPorts();
                const server = await startTestFakeServer({
                    schemaString: schema,
                    ports,
                });
                const { urls } = await server.start();
                const sequenceId = crypto.randomUUID();

                // First register default fake (no condition)
                const defaultFake: RegisterSequenceOptions = {
                    type: "operation",
                    operationName: "GetUser",
                    data: {
                        user: {
                            id: "default-user",
                            name: "Default User",
                        },
                    },
                };

                await fetch(`${urls.fakeServer}/fake`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "sequence-id": sequenceId,
                    },
                    body: JSON.stringify(defaultFake),
                });

                // Try to register count condition - should fail
                const countFake: RegisterSequenceOptions = {
                    type: "operation",
                    operationName: "GetUser",
                    requestCondition: { type: "count", value: 1 },
                    data: {
                        user: {
                            id: "count-user",
                            name: "Count User",
                        },
                    },
                };

                const response = await fetch(`${urls.fakeServer}/fake`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "sequence-id": sequenceId,
                    },
                    body: JSON.stringify(countFake),
                });

                const result = (await response.json()) as any;
                expect(result.ok).toBe(false);
                expect(result.errors).toContain(
                    "Conflicting condition types detected: count-based condition (e.g., { type: 'count', value: 1 }) vs default condition (no requestCondition specified). Allowed combinations are: count+count, variables+variables, variables+default, or default+default.",
                );
            });

            it("should reject count condition when variables condition is already registered", async () => {
                const schema = `
                    type User {
                        id: ID! @exampleID(value: "user-id")
                        name: String! @exampleString(value: "Default User")
                    }
                    type Query {
                        user(id: ID!): User!
                    }
                `;
                const ports = getPorts();
                const server = await startTestFakeServer({
                    schemaString: schema,
                    ports,
                });
                const { urls } = await server.start();
                const sequenceId = crypto.randomUUID();

                // First register variables condition
                const variablesFake: RegisterSequenceOptions = {
                    type: "operation",
                    operationName: "GetUser",
                    requestCondition: { type: "variables", value: { id: "user123" } },
                    data: {
                        user: {
                            id: "vars-user",
                            name: "Variables User",
                        },
                    },
                };

                await fetch(`${urls.fakeServer}/fake`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "sequence-id": sequenceId,
                    },
                    body: JSON.stringify(variablesFake),
                });

                // Try to register count condition - should fail
                const countFake: RegisterSequenceOptions = {
                    type: "operation",
                    operationName: "GetUser",
                    requestCondition: { type: "count", value: 1 },
                    data: {
                        user: {
                            id: "count-user",
                            name: "Count User",
                        },
                    },
                };

                const response = await fetch(`${urls.fakeServer}/fake`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "sequence-id": sequenceId,
                    },
                    body: JSON.stringify(countFake),
                });

                const result = (await response.json()) as any;
                expect(result.ok).toBe(false);
                expect(result.errors).toContain(
                    "Cannot mix count-based and variables-based conditions for the same operation. Use either multiple count conditions (for different call numbers) or multiple variables conditions (for different variable sets), but not both. Current conflict: count-based condition (e.g., { type: 'count', value: 1 }) vs variables-based condition (e.g., { type: 'variables', value: {...} })",
                );
            });

            it("should allow variables and default conditions to coexist", async () => {
                const schema = `
                    type User {
                        id: ID! @exampleID(value: "user-id")
                        name: String! @exampleString(value: "Default User")
                    }
                    type Query {
                        user(id: ID!): User!
                    }
                `;
                const ports = getPorts();
                const server = await startTestFakeServer({
                    schemaString: schema,
                    ports,
                });
                const { urls } = await server.start();
                const sequenceId = crypto.randomUUID();

                // First register default fake (no condition)
                const defaultFake: RegisterSequenceOptions = {
                    type: "operation",
                    operationName: "GetUser",
                    data: {
                        user: {
                            id: "default-user",
                            name: "Default User",
                        },
                    },
                };

                const defaultResponse = await fetch(`${urls.fakeServer}/fake`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "sequence-id": sequenceId,
                    },
                    body: JSON.stringify(defaultFake),
                });

                const defaultResult = (await defaultResponse.json()) as any;
                expect(defaultResult.ok).toBe(true);

                // Register variables condition - should succeed
                const variablesFake: RegisterSequenceOptions = {
                    type: "operation",
                    operationName: "GetUser",
                    requestCondition: { type: "variables", value: { id: "special" } },
                    data: {
                        user: {
                            id: "special-user",
                            name: "Special User",
                        },
                    },
                };

                const variablesResponse = await fetch(`${urls.fakeServer}/fake`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "sequence-id": sequenceId,
                    },
                    body: JSON.stringify(variablesFake),
                });

                const variablesResult = (await variablesResponse.json()) as any;
                expect(variablesResult.ok).toBe(true);
            });
        });
    });
});
