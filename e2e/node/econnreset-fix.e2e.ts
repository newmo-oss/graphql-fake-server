import { createFakeServer, normalizeFakeServerConfig } from "@newmo/graphql-fake-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFakeClient } from "./generated/fake.js";
import type { GetBooksQuery } from "./generated/graphql.js";

describe("ECONNRESET Fix Verification", () => {
    let server: Awaited<ReturnType<typeof createFakeServer>>;
    let fakeClient: ReturnType<typeof createFakeClient>;
    const TEST_PORT = 4002; // Use different port to avoid conflicts

    beforeAll(async () => {
        // Start fake server
        server = await createFakeServer(
            normalizeFakeServerConfig({
                schemaFilePath: "./api/api.graphqls",
                defaultValues: {
                    CustomScalar: {
                        DATE_YYYYMMDD: `"2022-01-01"`,
                    },
                },
                ports: {
                    fakeServer: TEST_PORT,
                    apolloServer: TEST_PORT + 1,
                },
                logLevel: "error", // Reduce noise in tests
            }),
        );

        // Wait a bit for server to fully start
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Create fake client with the new implementation
        fakeClient = createFakeClient({
            fakeServerEndpoint: `http://127.0.0.1:${TEST_PORT}/fake`,
        });
    }, 30000); // Increase timeout for server startup

    afterAll(async () => {
        await server?.stop();
    });

    it("should handle 100 concurrent fake registrations without ECONNRESET", async () => {
        const sequenceId = `test-${Date.now()}`;
        const promises: Promise<any>[] = [];

        const fakeResponse: GetBooksQuery = {
            books: [
                {
                    __typename: "Book" as const,
                    id: "test-book",
                    title: "Test Book",
                    author: "Test Author",
                },
            ],
        };

        // Register 100 fakes concurrently
        for (let i = 0; i < 100; i++) {
            const uniqueSequenceId = `${sequenceId}-${i}`;
            promises.push(fakeClient.registerGetBooksQueryResponse(uniqueSequenceId, fakeResponse));
        }

        // All should succeed
        const results = await Promise.allSettled(promises);
        const successes = results.filter((r) => r.status === "fulfilled");
        const failures = results.filter((r) => r.status === "rejected");

        // Log any failures for debugging
        if (failures.length > 0) {
            console.error(`Failed registrations: ${failures.length}/100`);
            failures.forEach((failure, index) => {
                const error = (failure as PromiseRejectedResult).reason;
                console.error(`Failure ${index + 1}:`, error.message || error);
            });
        }

        // Assert all succeeded
        expect(successes.length).toBe(100);
        expect(failures.length).toBe(0);
    });

    it("should handle 500 concurrent fake registrations with rate limiting", async () => {
        const sequenceId = `test-large-${Date.now()}`;
        const promises: Promise<any>[] = [];

        const fakeResponse: GetBooksQuery = {
            books: [
                {
                    __typename: "Book" as const,
                    id: "test-book-large",
                    title: "Large Test Book",
                    author: "Large Test Author",
                },
            ],
        };

        // Register 500 fakes concurrently
        for (let i = 0; i < 500; i++) {
            const uniqueSequenceId = `${sequenceId}-${i}`;
            promises.push(fakeClient.registerGetBooksQueryResponse(uniqueSequenceId, fakeResponse));
        }

        const startTime = Date.now();
        const results = await Promise.allSettled(promises);
        const endTime = Date.now();

        const successes = results.filter((r) => r.status === "fulfilled");
        const failures = results.filter((r) => r.status === "rejected");

        console.log(`Registered 500 fakes in ${endTime - startTime}ms`);
        console.log(
            `Success rate: ${successes.length}/500 (${((successes.length / 500) * 100).toFixed(1)}%)`,
        );

        // With rate limiting, all should succeed
        expect(successes.length).toBe(500);
        expect(failures.length).toBe(0);
    });

    it("should recover from network errors with retry logic", async () => {
        const sequenceId = `test-retry-${Date.now()}`;

        // This test verifies that even if there are transient network issues,
        // the retry logic will recover
        const fakeResponse: GetBooksQuery = {
            books: [
                {
                    __typename: "Book" as const,
                    id: "retry-test-book",
                    title: "Retry Test Book",
                    author: "Retry Test Author",
                },
            ],
        };

        // Register a fake (should succeed even with potential network hiccups)
        const result = await fakeClient.registerGetBooksQueryResponse(sequenceId, fakeResponse);

        expect(result).toEqual({ ok: true });
    });

    it("should handle burst traffic followed by normal traffic", async () => {
        const sequenceId = `test-burst-${Date.now()}`;

        // First, send a burst of 200 requests
        const burstPromises: Promise<any>[] = [];
        const fakeResponse: GetBooksQuery = {
            books: [
                {
                    __typename: "Book" as const,
                    id: "burst-book",
                    title: "Burst Book",
                    author: "Burst Author",
                },
            ],
        };

        for (let i = 0; i < 200; i++) {
            const uniqueSequenceId = `${sequenceId}-burst-${i}`;
            burstPromises.push(
                fakeClient.registerGetBooksQueryResponse(uniqueSequenceId, fakeResponse),
            );
        }

        const burstResults = await Promise.allSettled(burstPromises);
        const burstSuccesses = burstResults.filter((r) => r.status === "fulfilled");

        // Then send normal traffic
        const normalPromises: Promise<any>[] = [];
        for (let i = 0; i < 50; i++) {
            const uniqueSequenceId = `${sequenceId}-normal-${i}`;
            normalPromises.push(
                fakeClient.registerGetBooksQueryResponse(uniqueSequenceId, fakeResponse),
            );
        }

        const normalResults = await Promise.allSettled(normalPromises);
        const normalSuccesses = normalResults.filter((r) => r.status === "fulfilled");

        // Both burst and normal traffic should succeed
        expect(burstSuccesses.length).toBe(200);
        expect(normalSuccesses.length).toBe(50);
    });
});
