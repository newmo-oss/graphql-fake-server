import { describe, expect, it } from 'vitest'
import { createMock, MockObject } from './index.js'
import { buildSchema } from "graphql/utilities/index.js";
import { extendSchema } from "@newmo/graphql-fake-core";

describe('createMock', () => {
    it('should generate a mock object', async () => {
        const schema = buildSchema(`type Query { hello: String }`);
        const mock: MockObject = await createMock({
            schema
        })
        expect(mock).toMatchInlineSnapshot(`
          {
            "Query": {
              "hello": "string",
            },
          }
        `)
    });
    it('should support @exampleID directive for a array of object ', async () => {
        const schema = buildSchema(extendSchema(`
           type Query { books: [Book!] }
           type Book {
                id: ID! @exampleID(value: "id")
                title: String @exampleString(value: "title")
           }
        `));
        const mock: MockObject = await createMock({
            schema
        })
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
        `)
    });
    it('should support @exampleString directive for a mock object', async () => {
        const schema = buildSchema(extendSchema(`type Query { hello: String! @exampleString(value: "Hello World") }`));
        const mock: MockObject = await createMock({
            schema
        })
        expect(mock).toMatchInlineSnapshot(`
          {
            "Query": {
              "hello": "Hello World",
            },
          }
        `)
    });
})
