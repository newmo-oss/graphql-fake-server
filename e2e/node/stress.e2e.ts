import { createFakeServer, normalizeFakeServerConfig } from "@newmo/graphql-fake-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFakeClient } from "./generated/fake.js";
import type { GetBooksQuery } from "./generated/graphql.js";

// https://github.com/newmo-oss/graphql-fake-server/issues/92
describe("stress test", () => {
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

        // Start the server
        await server.start();

        // Create fake client with the new implementation
        fakeClient = createFakeClient({
            fakeServerEndpoint: `http://127.0.0.1:${TEST_PORT}/fake`,
        });
    }, 30000); // Increase timeout for server startup

    afterAll(async () => {
        await server?.stop();
    });

    it("should handle 1000 concurrent fake registrations without ECONNRESET", async () => {
        const sequenceId = `test-${Date.now()}`;
        const promises: Promise<any>[] = [];

        const fakeResponse: GetBooksQuery = {
            __typename: "Query",
            books: [
                {
                    __typename: "Book" as const,
                    id: "test-book",
                    title: "Test Book",
                },
            ],
        };

        // Register 100 fakes concurrently
        for (let i = 0; i < 1000; i++) {
            const uniqueSequenceId = `${sequenceId}-${i}`;
            promises.push(fakeClient.registerGetBooksQueryResponse(uniqueSequenceId, fakeResponse));
        }

        // All should succeed
        const results = await Promise.allSettled(promises);
        const successes = results.filter((r) => r.status === "fulfilled");
        const failures = results.filter((r) => r.status === "rejected");

        // Log any failures for debugging
        if (failures.length > 0) {
            console.error(`Failed registrations: ${failures.length}/1000`);
            failures.forEach((failure, index) => {
                const error = (failure as PromiseRejectedResult).reason;
                console.error(`Failure ${index + 1}:`, error.message || error);
            });
        }

        // Assert all succeeded
        expect(successes.length).toBe(1000);
        expect(failures.length).toBe(0);
    });
});
