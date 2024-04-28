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
            "createQuery": [Function],
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
            "createQuery": [Function],
          }
        `)
    });
})
