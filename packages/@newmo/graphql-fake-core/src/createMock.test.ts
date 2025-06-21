import { buildSchema } from "graphql";
import { describe, expect, it } from "vitest";
import { createMock, type MockObject } from "./createMock.js";
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
              "id": "id_g3_d0_c3",
              "title": "title",
            },
            "Query": {
              "books": [
                {
                  "id": "id_g0_d1_c0",
                  "title": "title",
                },
                {
                  "id": "id_g1_d1_c1",
                  "title": "title",
                },
                {
                  "id": "id_g2_d1_c2",
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
    it("should support @exampleInt directive for a mock object", async () => {
        const schema = buildSchema(extendSchema("type Query { num: Int! @exampleInt(value: 12) }"));
        const { mock }: MockObject = await createMock({
            schema,
        });
        expect(mock).toMatchInlineSnapshot(`
          {
            "Query": {
              "num": 12,
            },
          }
        `);
    });
    it("should support @exampleFloat directive for a mock object", async () => {
        const schema = buildSchema(
            extendSchema("type Query { num: Float! @exampleFloat(value: 12.34) }"),
        );
        const { mock }: MockObject = await createMock({
            schema,
        });
        expect(mock).toMatchInlineSnapshot(`
          {
            "Query": {
              "num": 12.34,
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
                "id": "xxxx-xxxx-xxxx-xxxx_g1_d2_c1",
                "name": "string",
              },
            },
            "User": {
              "id": "xxxx-xxxx-xxxx-xxxx_g0_d0_c0",
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
                "id": "xxxx-xxxx-xxxx-xxxx_g1_d1_c1",
                "name": "string",
              },
            },
            "User": {
              "id": "xxxx-xxxx-xxxx-xxxx_g0_d0_c0",
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
                "id": "xxxx-xxxx-xxxx-xxxx_g1_d1_c1",
                "name": "string",
              },
              "message": "string",
            },
            "Query": {
              "user": {
                "__typename": "User",
                "id": "xxxx-xxxx-xxxx-xxxx_g2_d2_c2",
                "name": "string",
              },
            },
            "Suspended": {
              "reason": "string",
            },
            "User": {
              "id": "xxxx-xxxx-xxxx-xxxx_g0_d0_c0",
              "name": "string",
            },
          }
        `);
    });
    it("should support custom scalar with @exampleScalarString", async () => {
        const schema = buildSchema(
            extendSchema(`
        scalar Date @exampleScalarString(value: "2024-06-25T14:52:42.074Z")
        type User {
          id: ID!
          name: String
          createdAt: Date
        }
        type Query {
            user: User
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
                "createdAt": "2024-06-25T14:52:42.074Z",
                "id": "xxxx-xxxx-xxxx-xxxx_g1_d1_c1",
                "name": "string",
              },
            },
            "User": {
              "createdAt": "2024-06-25T14:52:42.074Z",
              "id": "xxxx-xxxx-xxxx-xxxx_g0_d0_c0",
              "name": "string",
            },
          }
        `);
    });
    it("should support custom scalar with @exampleScalarInt", async () => {
        const schema = buildSchema(
            extendSchema(`
        scalar IntValue @exampleScalarInt(value: 123)
        type User {
            value: IntValue
        }
        type Query {
            user: User
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
                "value": 123,
              },
            },
            "User": {
              "value": 123,
            },
          }
        `);
    });
    it("should support custom scalar with @exampleScalarFloat", async () => {
        const schema = buildSchema(
            extendSchema(`
        scalar FloatValue @exampleScalarFloat(value: 123.45)
        type User {
            value: FloatValue
        }
        type Query {
            user: User
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
                "value": 123.45,
              },
            },
            "User": {
              "value": 123.45,
            },
          }
        `);
    });

    it("should support custom scalar with @exampleScalarBoolean", async () => {
        const schema = buildSchema(
            extendSchema(`
        scalar BooleanValue @exampleScalarBoolean(value: true)
        type User {
            value: BooleanValue
        }
        type Query {
            user: User
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
                "value": true,
              },
            },
            "User": {
              "value": true,
            },
          }
        `);
    });
    it("should support custom scalar with config", async () => {
        const schema = buildSchema(`
        scalar Date
        type User {
          id: ID!
          name: String
          createdAt: Date
        }
        type Query {
            user: User
        }
    `);
        const { mock }: MockObject = await createMock({
            schema,
            defaultValues: {
                CustomScalar: {
                    Date: "new Date('2024-06-25T14:52:42.074Z').toISOString()",
                },
            },
        });
        expect(mock).toMatchInlineSnapshot(`
          {
            "Query": {
              "user": {
                "createdAt": "2024-06-25T14:52:42.074Z",
                "id": "xxxx-xxxx-xxxx-xxxx_g1_d1_c1",
                "name": "string",
              },
            },
            "User": {
              "createdAt": "2024-06-25T14:52:42.074Z",
              "id": "xxxx-xxxx-xxxx-xxxx_g0_d0_c0",
              "name": "string",
            },
          }
        `);
    });
    it("should support custom scalar with @exampleString", async () => {
        const schema = buildSchema(
            extendSchema(`
        scalar Date
        type User {
          id: ID!
          name: String
          createdAt: Date @exampleFloat(value: "2024-06-25")
        }
        type Query {
            user: User
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
                "createdAt": "2024-06-25",
                "id": "xxxx-xxxx-xxxx-xxxx_g1_d1_c1",
                "name": "string",
              },
            },
            "User": {
              "createdAt": "2024-06-25",
              "id": "xxxx-xxxx-xxxx-xxxx_g0_d0_c0",
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
                "id": "xxxx-xxxx-xxxx-xxxx_g1_d1_c1",
                "name": "string",
              },
            },
            "User": {
              "id": "xxxx-xxxx-xxxx-xxxx_g0_d0_c0",
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
                "id": "id_g1_d1_c1",
                "name": "john",
              },
              "message": "blocked",
            },
            "Query": {
              "user": {
                "__typename": "User",
                "id": "id_g2_d2_c2",
                "name": "john",
              },
            },
            "Suspended": {
              "reason": "error reason",
            },
            "User": {
              "id": "id_g0_d0_c0",
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
                "id1_g0_d0_c0",
                "id2_g1_d0_c0",
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
              "id": "xxxx-xxxx-xxxx-xxxx_g1_d0_c1",
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
                  "id": "xxxx-xxxx-xxxx-xxxx_g0_d2_c0",
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
                "id": "xxxx-xxxx-xxxx-xxxx_g2_d1_c2",
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
                "id": "xxxx-xxxx-xxxx-xxxx_g0_d1_c0",
                "name": "string",
              },
            },
            "User": {
              "errors": [],
              "id": "xxxx-xxxx-xxxx-xxxx_g1_d0_c1",
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
        const result = await createMock({
            schema,
        });
        if (!result.ok) throw result.error;
        expect(result.mock).toMatchInlineSnapshot(`
          {
            "CreateFooURLErrorDetail": {
              "code": "FAILED_TO_CREATE_FOO_URL",
              "message": "string",
            },
            "FooURLInput": {
              "URL": "string",
            },
            "FooURLPayload": {
              "URL": "string",
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
});
