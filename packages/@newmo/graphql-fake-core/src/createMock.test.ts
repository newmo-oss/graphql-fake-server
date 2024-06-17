import { buildSchema } from "graphql";
import { describe, expect, it } from "vitest";
import { type MockObject, createMock } from "./createMock.js";
import { extendSchema } from "./extend-schema.js";

describe("createMock", () => {
    it("should generate a mock object", async () => {
        const schema = buildSchema("type Query { hello: String }");
        const { mock }: MockObject = await createMock({
            schema,
        });
        expect(mock).toMatchInlineSnapshot(`
          {
            "Query": {
              "hello": "string",
            },
          }
        `);
    });

    it("should support @exampleID directive for a array of object ", async () => {
        const schema = buildSchema(
            extendSchema(`
           type Query { books: [Book!] }
           type Book {
                id: ID! @exampleID(value: "id")
                title: String @exampleString(value: "title")
           }
        `),
        );
        const { mock }: MockObject = await createMock({
            schema,
        });
        expect(mock).toMatchInlineSnapshot(`
          {
            "Book": {
              "id": "id03",
              "title": "title",
            },
            "Query": {
              "books": [
                {
                  "id": "id10",
                  "title": "title",
                },
                {
                  "id": "id11",
                  "title": "title",
                },
                {
                  "id": "id12",
                  "title": "title",
                },
              ],
            },
          }
        `);
    });
    it("should support @exampleString directive for a mock object", async () => {
        const schema = buildSchema(
            extendSchema(`type Query { hello: String! @exampleString(value: "Hello World") }`),
        );
        const { mock }: MockObject = await createMock({
            schema,
        });
        expect(mock).toMatchInlineSnapshot(`
          {
            "Query": {
              "hello": "Hello World",
            },
          }
        `);
    });
    it("should support Enum for a mock object", async () => {
        const schema = buildSchema(
            extendSchema(`
enum DocumentType {
    LICENSE
    TICKET
}

type RequiredDocument {
  name: String!
  type: DocumentType!
}
`),
        );
        const { mock }: MockObject = await createMock({
            schema,
        });
        expect(mock).toMatchInlineSnapshot(`
          {
            "RequiredDocument": {
              "name": "string",
              "type": "LICENSE",
            },
          }
        `);
    });
    it("should support interface", async () => {
        const schema = buildSchema(`
        interface Node {
            id: ID!
        }
        type User implements Node {
            id: ID!
            name: String
        }
        type Query {
            node: Node
        }
    `);
        const result = await createMock({
            schema,
        });
        if (!result.ok) throw result.error;
        expect(result.mock).toMatchInlineSnapshot(`
          {
            "Query": {
              "node": {
                "__typename": "User",
                "id": "xxxx-xxxx-xxxx-xxxx21",
                "name": "string",
              },
            },
            "User": {
              "id": "xxxx-xxxx-xxxx-xxxx00",
              "name": "string",
            },
          }
        `);
    });
    it("should support multiple interface", async () => {
        const schema = buildSchema(`
        interface Node {
            id: ID!
        }
        interface Name {
            name: String
        }
        type User implements Node & Name {
            id: ID!
            name: String
        }
        type Query {
            user: User
        }
    `);
        const result = await createMock({
            schema,
        });
        if (!result.ok) throw result.error;
        expect(result.mock).toMatchInlineSnapshot(`
          {
            "Query": {
              "user": {
                "id": "xxxx-xxxx-xxxx-xxxx11",
                "name": "string",
              },
            },
            "User": {
              "id": "xxxx-xxxx-xxxx-xxxx00",
              "name": "string",
            },
          }
        `);
    });
    it("should support union", async () => {
        const schema = buildSchema(`
        type User {
          id: ID!
          name: String
        }
        type Suspended {
          reason: String
        }
        type IsBlocked {
          message: String
          blockedByUser: User
        }
        union UserResult = User | IsBlocked | Suspended
        type Query {
            user: UserResult
        }
    `);
        const { mock }: MockObject = await createMock({
            schema,
        });
        expect(mock).toMatchInlineSnapshot(`
          {
            "IsBlocked": {
              "blockedByUser": {
                "id": "xxxx-xxxx-xxxx-xxxx11",
                "name": "string",
              },
              "message": "string",
            },
            "Query": {
              "user": {
                "__typename": "User",
                "id": "xxxx-xxxx-xxxx-xxxx22",
                "name": "string",
              },
            },
            "Suspended": {
              "reason": "string",
            },
            "User": {
              "id": "xxxx-xxxx-xxxx-xxxx00",
              "name": "string",
            },
          }
        `);
    });
    it("should extend interface type", async () => {
        // https://spec.graphql.org/October2021/#sec-Interface-Extensions
        const schema = buildSchema(`
        interface Node {
            id: ID!
        }
        extend interface Node {
            name: String
        }
        type User implements Node {
            id: ID!
            name: String
        }
        type Query {
            user: User
        }
    `);
        const result = await createMock({
            schema,
        });
        if (!result.ok) throw result.error;
        expect(result.mock).toMatchInlineSnapshot(`
          {
            "Query": {
              "user": {
                "id": "xxxx-xxxx-xxxx-xxxx11",
                "name": "string",
              },
            },
            "User": {
              "id": "xxxx-xxxx-xxxx-xxxx00",
              "name": "string",
            },
          }
        `);
    });
    it("should support union with @example directive", async () => {
        const schema = buildSchema(
            extendSchema(`
        type User {
          id: ID! @exampleID(value: "id")
          name: String @exampleString(value: "john")
        }
        type Suspended {
          reason: String @exampleString(value: "error reason")
        }
        type IsBlocked {
          message: String @exampleString(value: "blocked")
          blockedByUser: User
        }
        union UserResult = User | IsBlocked | Suspended
        type Query {
            user: UserResult
        }
    `),
        );
        const { mock }: MockObject = await createMock({
            schema,
        });
        expect(mock).toMatchInlineSnapshot(`
          {
            "IsBlocked": {
              "blockedByUser": {
                "id": "id11",
                "name": "john",
              },
              "message": "blocked",
            },
            "Query": {
              "user": {
                "__typename": "User",
                "id": "id22",
                "name": "john",
              },
            },
            "Suspended": {
              "reason": "error reason",
            },
            "User": {
              "id": "id00",
              "name": "john",
            },
          }
        `);
    });
    it("should allow [String!] @exampleArrayString()", async () => {
        const schema = buildSchema(
            extendSchema(`
            type Query {
                names: [String!] @exampleArrayString(values: ["john", "mike"])
            }
            `),
        );
        const { mock }: MockObject = await createMock({
            schema,
        });
        expect(mock).toMatchInlineSnapshot(`
          {
            "Query": {
              "names": [
                "john",
                "mike",
              ],
            },
          }
        `);
    });
    it("should allow [String!]! @exampleArrayString()", async () => {
        const schema = buildSchema(
            extendSchema(`
            type Query {
                names: [String!]! @exampleArrayString(values: ["john", "mike"])
            }
            `),
        );
        const { mock }: MockObject = await createMock({
            schema,
        });
        expect(mock).toMatchInlineSnapshot(`
          {
            "Query": {
              "names": [
                "john",
                "mike",
              ],
            },
          }
        `);
    });
    it("should allow [Int!] @exampleArrayInt()", async () => {
        const schema = buildSchema(
            extendSchema(`
            type Query {
             values: [Int!] @exampleArrayInt(values: [1, 2, 3])
            }
            `),
        );
        const { mock }: MockObject = await createMock({
            schema,
        });
        expect(mock).toMatchInlineSnapshot(`
          {
            "Query": {
              "values": [
                1,
                2,
                3,
              ],
            },
          }
        `);
    });
    it("should allow [Float!] @exampleArrayFloat()", async () => {
        const schema = buildSchema(
            extendSchema(`
            type Query {
              values: [Float!] @exampleArrayFloat(values: [1.1, 2.2, 3.3])
            }
            `),
        );
        const { mock }: MockObject = await createMock({
            schema,
        });
        expect(mock).toMatchInlineSnapshot(`
          {
            "Query": {
              "values": [
                1.1,
                2.2,
                3.3,
              ],
            },
          }
        `);
    });
    it("should allow [Boolean!] @exampleArrayBoolean()", async () => {
        const schema = buildSchema(
            extendSchema(`
            type Query {
             values: [Boolean!] @exampleArrayBoolean(values: [true, false])
            }
            `),
        );
        const { mock }: MockObject = await createMock({
            schema,
        });
        expect(mock).toMatchInlineSnapshot(`
          {
            "Query": {
              "values": [
                true,
                false,
              ],
            },
          }
        `);
    });
    it("should allow [ID!] @exampleArrayID()", async () => {
        const schema = buildSchema(
            extendSchema(`
            type Query {
             values: [ID!] @exampleArrayID(values: ["id1", "id2"])
            }
            `),
        );
        const { mock }: MockObject = await createMock({
            schema,
        });
        expect(mock).toMatchInlineSnapshot(`
          {
            "Query": {
              "values": [
                "id100",
                "id200",
              ],
            },
          }
        `);
    });
    it("should throw error if @exampleArrayString() is not a array", async () => {
        const schema = buildSchema(
            extendSchema(`
            type Query {
                names: [String!] @exampleArrayString(values: "john")
            }
            `),
        );
        await expect(() =>
            createMock({
                schema,
            }),
        ).rejects.toMatchInlineSnapshot(
            "[Error: @exampleArrayString directive must have values argument. @exampleArrayString(values: ...). values is not array.]",
        );
    });
    it("should throw error if @exampleArrayInt() is not a array", async () => {
        const schema = buildSchema(
            extendSchema(`
            type Query {
                values: [Int!] @exampleArrayInt(values: 1)
            }
            `),
        );
        await expect(() =>
            createMock({
                schema,
            }),
        ).rejects.toMatchInlineSnapshot(
            "[Error: @exampleArrayInt directive must have values argument. @exampleArrayInt(values: ...). values is not array.]",
        );
    });

    it("should throw error if @exampleArray* mismatch type value", async () => {
        const schema = buildSchema(
            extendSchema(`
            type Query {
                values: [Int!] @exampleArrayInt(values: [1, "test"])
            }
            `),
        );
        await expect(() =>
            createMock({
                schema,
            }),
        ).rejects.toMatchInlineSnapshot(
            "[Error: Query.values: @exampleArrayInt directive values must be the same type. Got [1, test]]",
        );
    });
    it("should handle mutation errors pattern", async () => {
        // https://productionreadygraphql.com/2020-08-01-guide-to-graphql-errors
        // https://speakerdeck.com/yukukotani/graphql-schema-design-practice?slide=23
        const schema = buildSchema(`
    type Mutation {
      useFooBar(input: UseFooBarInput!): UseFooBarPayload!
    }
   
    input UseFooBarInput {
      id: String!
    }
    
    type FooBar {
        id: ID!
        name: String
    }
    type UseFooBarPayload {
      fooBar: FooBar
      
      errors: [UseFooBarError!]!
    }
    
    union UseFooBarError = GeneralError | AbcError

    type GeneralError implements Error {
      message: String!
    }
    
    type AbcError implements Error & DisplayableError {
      message: String!
      code: AbcErrorCode!
      localizedMessage: String!
    }
    
    enum AbcErrorCode {
      INVALID
      ALREADY_EXIST
    }
    interface Error {
      message: String!
    }
    
    interface DisplayableError {
      message: String
      localizedMessage: String!
    }
    
    mutation UseFooBarMutation {
        useFooBar(input: {
          id: "x"
        }) {
        userErrors {
          ... on GeneralError {
            message
          }
          ... on AbcError {
            message
            code
            localizedMessage
          }
          ... on DisplayableError {
            localizedMessage
            message
          }
          ... on Error {
            message
          }
        }
      }
    }
`);
        const { mock }: MockObject = await createMock({
            schema,
        });
        expect(mock).toMatchInlineSnapshot(`
          {
            "AbcError": {
              "code": "INVALID",
              "localizedMessage": "string",
              "message": "string",
            },
            "FooBar": {
              "id": "xxxx-xxxx-xxxx-xxxx01",
              "name": "string",
            },
            "GeneralError": {
              "message": "string",
            },
            "Mutation": {
              "useFooBar": {
                "errors": [
                  {
                    "__typename": "GeneralError",
                    "message": "string",
                  },
                  {
                    "__typename": "GeneralError",
                    "message": "string",
                  },
                  {
                    "__typename": "GeneralError",
                    "message": "string",
                  },
                ],
                "fooBar": {
                  "id": "xxxx-xxxx-xxxx-xxxx20",
                  "name": "string",
                },
              },
            },
            "UseFooBarInput": {
              "id": "string",
            },
            "UseFooBarPayload": {
              "errors": [
                {
                  "__typename": "GeneralError",
                  "message": "string",
                },
                {
                  "__typename": "GeneralError",
                  "message": "string",
                },
                {
                  "__typename": "GeneralError",
                  "message": "string",
                },
              ],
              "fooBar": {
                "id": "xxxx-xxxx-xxxx-xxxx12",
                "name": "string",
              },
            },
          }
        `);
    });
    it("should handle @error directive", async () => {
        const schema = buildSchema(
            extendSchema(`
            type Query {
              user: User
            }

            type User {
              id: ID!
              name: String
              errors: [UserError!]! @error
            }

            type UserError {
              message: String!
              code: String!
            }
          `),
        );
        const { mock }: MockObject = await createMock({
            schema,
        });
        expect(mock).toMatchInlineSnapshot(`
          {
            "Query": {
              "user": {
                "errors": [],
                "id": "xxxx-xxxx-xxxx-xxxx10",
                "name": "string",
              },
            },
            "User": {
              "errors": [],
              "id": "xxxx-xxxx-xxxx-xxxx01",
              "name": "string",
            },
            "UserError": {
              "code": "string",
              "message": "string",
            },
          }
        `);
    });
    it("support UpperCase enum", async () => {
        const schema = buildSchema(`
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
`);
        const { mock }: MockObject = await createMock({
            schema,
        });
        expect(mock).toMatchInlineSnapshot(`
          {
            "CreateFooUrlErrorDetail": {
              "code": "FAILED_TO_CREATE_FOO_URL",
              "message": "string",
            },
            "FooUrlInput": {
              "URL": "string",
            },
            "FooUrlPayload": {
              "URL": "string",
              "errors": [
                {
                  "__typename": "CreateFooUrlErrorDetail",
                  "code": "FAILED_TO_CREATE_FOO_URL",
                  "message": "string",
                },
                {
                  "__typename": "CreateFooUrlErrorDetail",
                  "code": "FAILED_TO_CREATE_FOO_URL",
                  "message": "string",
                },
                {
                  "__typename": "CreateFooUrlErrorDetail",
                  "code": "FAILED_TO_CREATE_FOO_URL",
                  "message": "string",
                },
              ],
            },
          }
        `);
    });
});
