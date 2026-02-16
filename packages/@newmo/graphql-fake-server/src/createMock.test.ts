import assert from "node:assert";
import { createMock, extendSchema } from "@newmo/graphql-fake-core";
import { buildSchema } from "graphql/utilities/index.js";
import { describe, expect, it } from "vitest";
import { createFakeServerInternal } from "./server.js";

let portCounter = 200;
const getPorts = () => {
    portCounter += 2;
    return {
        fakeServer: 6000 + portCounter,
        apolloServer: 6001 + portCounter,
    };
};

type GraphQLResponse = {
    data?: Record<string, unknown>;
    errors?: Array<{ message: string }>;
};

/**
 * Start a fake server with the given schema, send a query, and return the response data.
 */
const queryFakeServer = async (
    schemaString: string,
    query: string,
    options?: {
        mock?: Parameters<typeof createMock>[0]["mock"];
        maxQueryDepth?: number;
    },
) => {
    const schema = buildSchema(extendSchema(schemaString));
    const mockResult = await createMock({
        schema,
        mock: {
            maxDepth: 9,
            maxTypeRecursion: 2,
            listLength: 3,
            ...options?.mock,
        },
    });
    assert(mockResult.ok, "Failed to create mock");
    const ports = getPorts();
    const server = await createFakeServerInternal({
        schema,
        mockFactories: mockResult.factories,
        emptyListFields: mockResult.emptyListFields,
        logLevel: "info",
        ports,
        maxQueryDepth: options?.maxQueryDepth ?? 5,
        maxRegisteredSequences: 100,
        listLength: 3,
        allowedCORSOrigins: [],
        allowedHosts: "auto",
    });
    const { urls } = await server.start();
    try {
        const response = await fetch(`${urls.fakeServer}/graphql`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "sequence-id": `test-${portCounter}`,
            },
            body: JSON.stringify({ query }),
        });
        const result = (await response.json()) as GraphQLResponse;
        assert(result.data, `response should have data: ${JSON.stringify(result.errors)}`);
        return result.data;
    } finally {
        await server.stop();
    }
};

describe("createMock", () => {
    it("should generate a mock object", async () => {
        const data = await queryFakeServer("type Query { hello: String }", "{ hello }");
        expect(data).toMatchInlineSnapshot(`
          {
            "hello": "string",
          }
        `);
    });

    it("should support @exampleID directive for a array of object", async () => {
        const data = await queryFakeServer(
            `
            type Query { books: [Book!] }
            type Book {
                id: ID! @exampleID(value: "id")
                title: String @exampleString(value: "title")
            }
            `,
            "{ books { id title } }",
        );
        expect(data.books).toBeDefined();
        const books = data.books as Array<Record<string, unknown>>;
        assert(books.length > 0, "should have books");
        expect(books[0].title).toBe("title");
        // ID should start with "id" prefix from @exampleID
        expect((books[0].id as string).startsWith("id")).toBe(true);
    });
    it("should support @exampleString directive", async () => {
        const data = await queryFakeServer(
            'type Query { hello: String! @exampleString(value: "Hello World") }',
            "{ hello }",
        );
        expect(data).toMatchInlineSnapshot(`
          {
            "hello": "Hello World",
          }
        `);
    });
    it("should support @exampleInt directive", async () => {
        const data = await queryFakeServer(
            "type Query { num: Int! @exampleInt(value: 12) }",
            "{ num }",
        );
        expect(data).toMatchInlineSnapshot(`
          {
            "num": 12,
          }
        `);
    });
    it("should support @exampleFloat directive", async () => {
        const data = await queryFakeServer(
            "type Query { num: Float! @exampleFloat(value: 12.34) }",
            "{ num }",
        );
        expect(data).toMatchInlineSnapshot(`
          {
            "num": 12.34,
          }
        `);
    });
    it("should support Enum", async () => {
        const data = await queryFakeServer(
            `
            enum DocumentType { LICENSE TICKET }
            type RequiredDocument { name: String! type: DocumentType! }
            type Query { doc: RequiredDocument }
            `,
            "{ doc { name type } }",
        );
        expect(data).toMatchInlineSnapshot(`
          {
            "doc": {
              "name": "string",
              "type": "LICENSE",
            },
          }
        `);
    });
    it("should support interface", async () => {
        const data = await queryFakeServer(
            `
            interface Node { id: ID! }
            type User implements Node { id: ID! name: String }
            type Query { node: Node }
            `,
            "{ node { ... on User { id name } } }",
        );
        assert(data.node !== null, "node should not be null");
        const node = data.node as Record<string, unknown>;
        expect(node.id).toBeDefined();
        expect(node.name).toBeDefined();
    });
    it("should support multiple interface", async () => {
        const data = await queryFakeServer(
            `
            interface Node { id: ID! }
            interface Name { name: String }
            type User implements Node & Name { id: ID! name: String }
            type Query { user: User }
            `,
            "{ user { id name } }",
        );
        assert(data.user !== null, "user should not be null");
        const user = data.user as Record<string, unknown>;
        expect(user.id).toBeDefined();
        expect(user.name).toBeDefined();
    });
    it("should support union", async () => {
        const data = await queryFakeServer(
            `
            type User { id: ID! name: String }
            type Suspended { reason: String }
            type IsBlocked { message: String blockedByUser: User }
            union UserResult = User | IsBlocked | Suspended
            type Query { user: UserResult }
            `,
            `{
                user {
                    ... on User { id name }
                    ... on Suspended { reason }
                    ... on IsBlocked { message blockedByUser { id name } }
                }
            }`,
        );
        assert(data.user !== null, "user should not be null");
    });
    it("should support custom scalar with @exampleScalarString", async () => {
        const data = await queryFakeServer(
            `
            scalar Date @exampleScalarString(value: "2024-06-25T14:52:42.074Z")
            type User { id: ID! name: String createdAt: Date }
            type Query { user: User }
            `,
            "{ user { id name createdAt } }",
        );
        const user = data.user as Record<string, unknown>;
        expect(user.createdAt).toBe("2024-06-25T14:52:42.074Z");
    });
    it("should support custom scalar with @exampleScalarInt", async () => {
        const data = await queryFakeServer(
            `
            scalar IntValue @exampleScalarInt(value: 123)
            type User { value: IntValue }
            type Query { user: User }
            `,
            "{ user { value } }",
        );
        expect(data).toMatchInlineSnapshot(`
          {
            "user": {
              "value": 123,
            },
          }
        `);
    });
    it("should support custom scalar with @exampleScalarFloat", async () => {
        const data = await queryFakeServer(
            `
            scalar FloatValue @exampleScalarFloat(value: 123.45)
            type User { value: FloatValue }
            type Query { user: User }
            `,
            "{ user { value } }",
        );
        expect(data).toMatchInlineSnapshot(`
          {
            "user": {
              "value": 123.45,
            },
          }
        `);
    });
    it("should support custom scalar with @exampleScalarBoolean", async () => {
        const data = await queryFakeServer(
            `
            scalar BooleanValue @exampleScalarBoolean(value: true)
            type User { value: BooleanValue }
            type Query { user: User }
            `,
            "{ user { value } }",
        );
        expect(data).toMatchInlineSnapshot(`
          {
            "user": {
              "value": true,
            },
          }
        `);
    });
    it("should support custom scalar with config", async () => {
        const data = await queryFakeServer(
            `
            scalar Date
            type User { id: ID! name: String createdAt: Date }
            type Query { user: User }
            `,
            "{ user { id name createdAt } }",
            {
                mock: {
                    defaultValues: {
                        CustomScalar: {
                            Date: "new Date('2024-06-25T14:52:42.074Z').toISOString()",
                        },
                    },
                },
            },
        );
        const user = data.user as Record<string, unknown>;
        expect(user.createdAt).toBe("2024-06-25T14:52:42.074Z");
    });
    it("should support custom scalar with @exampleFloat on scalar field", async () => {
        const data = await queryFakeServer(
            `
            scalar Date
            type User { id: ID! name: String createdAt: Date @exampleFloat(value: "2024-06-25") }
            type Query { user: User }
            `,
            "{ user { id name createdAt } }",
        );
        const user = data.user as Record<string, unknown>;
        expect(user.createdAt).toBe("2024-06-25");
    });
    it("should extend interface type", async () => {
        const data = await queryFakeServer(
            `
            interface Node { id: ID! }
            extend interface Node { name: String }
            type User implements Node { id: ID! name: String }
            type Query { user: User }
            `,
            "{ user { id name } }",
        );
        assert(data.user !== null, "user should not be null");
        const user = data.user as Record<string, unknown>;
        expect(user.id).toBeDefined();
        expect(user.name).toBeDefined();
    });
    it("should support union with @example directive", async () => {
        const data = await queryFakeServer(
            `
            type User { id: ID! @exampleID(value: "id") name: String @exampleString(value: "john") }
            type Suspended { reason: String @exampleString(value: "error reason") }
            type IsBlocked { message: String @exampleString(value: "blocked") blockedByUser: User }
            union UserResult = User | IsBlocked | Suspended
            type Query { user: UserResult }
            `,
            `{
                user {
                    ... on User { id name }
                    ... on Suspended { reason }
                    ... on IsBlocked { message blockedByUser { id name } }
                }
            }`,
        );
        assert(data.user !== null, "user should not be null");
    });
    it("should allow [String!] @exampleArrayString()", async () => {
        const data = await queryFakeServer(
            'type Query { names: [String!] @exampleArrayString(values: ["john", "mike"]) }',
            "{ names }",
        );
        expect(data).toMatchInlineSnapshot(`
          {
            "names": [
              "john",
              "mike",
            ],
          }
        `);
    });
    it("should allow [String!]! @exampleArrayString()", async () => {
        const data = await queryFakeServer(
            'type Query { names: [String!]! @exampleArrayString(values: ["john", "mike"]) }',
            "{ names }",
        );
        expect(data).toMatchInlineSnapshot(`
          {
            "names": [
              "john",
              "mike",
            ],
          }
        `);
    });
    it("should allow [Int!] @exampleArrayInt()", async () => {
        const data = await queryFakeServer(
            "type Query { values: [Int!] @exampleArrayInt(values: [1, 2, 3]) }",
            "{ values }",
        );
        expect(data).toMatchInlineSnapshot(`
          {
            "values": [
              1,
              2,
              3,
            ],
          }
        `);
    });
    it("should allow [Float!] @exampleArrayFloat()", async () => {
        const data = await queryFakeServer(
            "type Query { values: [Float!] @exampleArrayFloat(values: [1.1, 2.2, 3.3]) }",
            "{ values }",
        );
        expect(data).toMatchInlineSnapshot(`
          {
            "values": [
              1.1,
              2.2,
              3.3,
            ],
          }
        `);
    });
    it("should allow [Boolean!] @exampleArrayBoolean()", async () => {
        const data = await queryFakeServer(
            "type Query { values: [Boolean!] @exampleArrayBoolean(values: [true, false]) }",
            "{ values }",
        );
        expect(data).toMatchInlineSnapshot(`
          {
            "values": [
              true,
              false,
            ],
          }
        `);
    });
    it("should allow [ID!] @exampleArrayID()", async () => {
        const data = await queryFakeServer(
            'type Query { values: [ID!] @exampleArrayID(values: ["id1", "id2"]) }',
            "{ values }",
        );
        expect(data.values).toBeDefined();
        const values = data.values as string[];
        expect(values.length).toBe(2);
        expect(values[0].startsWith("id1")).toBe(true);
        expect(values[1].startsWith("id2")).toBe(true);
    });
    it("should throw error if @exampleArrayString() is not a array", async () => {
        const schema = buildSchema(
            extendSchema('type Query { names: [String!] @exampleArrayString(values: "john") }'),
        );
        await expect(() => createMock({ schema })).rejects.toMatchInlineSnapshot(
            "[Error: @exampleArrayString directive must have values argument. @exampleArrayString(values: ...). values is not array.]",
        );
    });
    it("should throw error if @exampleArrayInt() is not a array", async () => {
        const schema = buildSchema(
            extendSchema("type Query { values: [Int!] @exampleArrayInt(values: 1) }"),
        );
        await expect(() => createMock({ schema })).rejects.toMatchInlineSnapshot(
            "[Error: @exampleArrayInt directive must have values argument. @exampleArrayInt(values: ...). values is not array.]",
        );
    });
    it("should throw error if @exampleArray* mismatch type value", async () => {
        const schema = buildSchema(
            extendSchema('type Query { values: [Int!] @exampleArrayInt(values: [1, "test"]) }'),
        );
        await expect(() => createMock({ schema })).rejects.toMatchInlineSnapshot(
            "[Error: Query.values: @exampleArrayInt directive values must be the same type. Got [1, test]]",
        );
    });
    it("should handle mutation errors pattern", async () => {
        const data = await queryFakeServer(
            `
            type Mutation { useFooBar(input: UseFooBarInput!): UseFooBarPayload! }
            input UseFooBarInput { id: String! }
            type FooBar { id: ID! name: String }
            type UseFooBarPayload { fooBar: FooBar errors: [UseFooBarError!]! }
            union UseFooBarError = GeneralError | AbcError
            type GeneralError implements Error { message: String! }
            type AbcError implements Error & DisplayableError { message: String! code: AbcErrorCode! localizedMessage: String! }
            enum AbcErrorCode { INVALID ALREADY_EXIST }
            interface Error { message: String! }
            interface DisplayableError { message: String localizedMessage: String! }
            type Query { _empty: String }
            `,
            `mutation {
                useFooBar(input: { id: "x" }) {
                    fooBar { id name }
                    errors {
                        ... on GeneralError { message }
                        ... on AbcError { message code localizedMessage }
                    }
                }
            }`,
        );
        assert(data.useFooBar !== null, "useFooBar should not be null");
        const payload = data.useFooBar as Record<string, unknown>;
        expect(payload.fooBar).toBeDefined();
        expect(Array.isArray(payload.errors)).toBe(true);
    });
    it("should handle @error directive", async () => {
        const data = await queryFakeServer(
            `
            type Query { user: User }
            type User { id: ID! name: String errors: [UserError!]! @error }
            type UserError { message: String! code: String! }
            `,
            "{ user { id name errors { message code } } }",
        );
        const user = data.user as Record<string, unknown>;
        expect(user.errors).toStrictEqual([]);
    });
    it("support UpperCase enum", async () => {
        const data = await queryFakeServer(
            `
            interface Error { message: String! }
            type FooURLPayload { URL: String! errors: [CreateFooURLError!]! }
            union CreateFooURLError = CreateFooURLErrorDetail
            type CreateFooURLErrorDetail implements Error { code: CreateFooURLErrorCode! message: String! }
            enum CreateFooURLErrorCode { FAILED_TO_CREATE_FOO_URL }
            type Query { fooURL: FooURLPayload }
            `,
            "{ fooURL { URL errors { ... on CreateFooURLErrorDetail { code message } } } }",
        );
        assert(data.fooURL !== null, "fooURL should not be null");
        const payload = data.fooURL as Record<string, unknown>;
        expect(payload.URL).toBe("string");
        expect(Array.isArray(payload.errors)).toBe(true);
    });
});
