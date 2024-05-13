import { describe, expect, it } from "vitest";
import { extendSchema } from "./extend-schema.js";
import { buildSchema } from "graphql";
import { type MockObject, createMock } from "./createMock.js";

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
});
