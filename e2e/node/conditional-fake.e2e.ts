import { GraphQLClient } from "graphql-request";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CreateBookDocument } from "./generated/graphql.js";
import { startTestServer } from "./helpers.js";

describe("conditional-fake", async () => {
    let server: Awaited<ReturnType<typeof startTestServer>>["server"];
    let fakeServerUrl = "";
    beforeAll(async () => {
        const result = await startTestServer({ fakeServer: 4032, apolloServer: 4033 });
        server = result.server;
        fakeServerUrl = result.urls.fakeServer;
    });
    afterAll(() => {
        server?.stop();
    });

    describe("Conditional Fake", () => {
        it("should handle variables-based conditions", async () => {
            const sequenceId = crypto.randomUUID();
            const client = new GraphQLClient(`${fakeServerUrl}/graphql`, {
                headers: {
                    "sequence-id": sequenceId,
                },
            });

            // Register fake for specific input
            await fetch(`${fakeServerUrl}/fake`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    type: "operation",
                    operationName: "CreateBook",
                    requestCondition: {
                        type: "variables",
                        value: {
                            input: {
                                title: "Test Book A",
                                authorId: "author-1",
                            },
                        },
                    },
                    data: {
                        createBook: {
                            id: "book-a",
                            title: "Test Book A - Created",
                        },
                    },
                }),
            });

            // Register fake for different input
            await fetch(`${fakeServerUrl}/fake`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    type: "operation",
                    operationName: "CreateBook",
                    requestCondition: {
                        type: "variables",
                        value: {
                            input: {
                                title: "Test Book B",
                                authorId: "author-2",
                            },
                        },
                    },
                    data: {
                        createBook: {
                            id: "book-b",
                            title: "Test Book B - Created",
                        },
                    },
                }),
            });

            // Call with first input
            const firstResponse = await client.request(CreateBookDocument, {
                input: {
                    title: "Test Book A",
                    authorId: "author-1",
                },
            });
            expect((firstResponse as { createBook: { title: string } }).createBook.title).toBe(
                "Test Book A - Created",
            );

            // Call with second input
            const secondResponse = await client.request(CreateBookDocument, {
                input: {
                    title: "Test Book B",
                    authorId: "author-2",
                },
            });
            expect((secondResponse as { createBook: { title: string } }).createBook.title).toBe(
                "Test Book B - Created",
            );
        });
    });

    describe("Condition conflicts", () => {
        it("should reject count condition when default fake is already registered", async () => {
            const sequenceId = crypto.randomUUID();

            // First register default fake (no condition)
            const defaultResponse = await fetch(`${fakeServerUrl}/fake`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    type: "operation",
                    operationName: "GetBooks",
                    data: {
                        books: [{ id: "default-book", title: "Default Book" }],
                    },
                }),
            });
            expect(defaultResponse.ok).toBe(true);

            // Try to register count condition - should fail with invalid condition type error
            const countResponse = await fetch(`${fakeServerUrl}/fake`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    type: "operation",
                    operationName: "GetBooks",
                    requestCondition: { type: "count", value: 1 },
                    data: {
                        books: [{ id: "count-book", title: "Count Book" }],
                    },
                }),
            });
            expect(countResponse.ok).toBe(false);
            const errorResult = (await countResponse.json()) as { errors: string[] };
            expect(errorResult.errors).toContain(
                "Invalid request conditions: Unknown condition type 'count'. Allowed types: always, variables",
            );
        });

        it("should allow variables and default conditions to coexist", async () => {
            const sequenceId = crypto.randomUUID();

            // First register default fake (no condition)
            const defaultResponse = await fetch(`${fakeServerUrl}/fake`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    type: "operation",
                    operationName: "GetBooks",
                    data: {
                        books: [{ id: "default-book", title: "Default Book" }],
                    },
                }),
            });
            expect(defaultResponse.ok).toBe(true);

            // Register variables condition - should succeed
            const variablesResponse = await fetch(`${fakeServerUrl}/fake`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "sequence-id": sequenceId,
                },
                body: JSON.stringify({
                    type: "operation",
                    operationName: "GetBooks",
                    requestCondition: { type: "variables", value: { filter: "special" } },
                    data: {
                        books: [{ id: "special-book", title: "Special Book" }],
                    },
                }),
            });
            expect(variablesResponse.ok).toBe(true);
        });
    });

    describe("Host Header Validation", () => {
        it("should reject requests with invalid Host header", async () => {
            // Use Node's http module to have full control over Host header
            const http = await import("node:http");
            const url = new URL(`${fakeServerUrl}/graphql`);

            const response = await new Promise<{ statusCode: number; body: string }>((resolve) => {
                const req = http.request(
                    {
                        hostname: url.hostname,
                        port: url.port,
                        path: url.pathname,
                        method: "POST",
                        headers: {
                            Host: "evil.com:4000", // Invalid host header
                            "Content-Type": "application/json",
                        },
                    },
                    (res) => {
                        let body = "";
                        res.on("data", (chunk) => {
                            body += chunk;
                        });
                        res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, body }));
                    },
                );

                req.on("error", (err) => {
                    throw err;
                });

                // Send a GraphQL query
                req.write(
                    JSON.stringify({
                        query: "{ books { id } }",
                    }),
                );
                req.end();
            });

            // Should be rejected by Host header validation
            expect(response.statusCode).toBe(400);
            expect(response.body).toContain("Bad Request: Invalid Host header");
        });
    });
});
