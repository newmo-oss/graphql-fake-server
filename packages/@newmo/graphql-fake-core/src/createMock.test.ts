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
});
