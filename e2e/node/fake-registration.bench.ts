import { createFakeServer, normalizeFakeServerConfig } from "@newmo/graphql-fake-server";
import { afterAll, beforeAll, bench, describe } from "vitest";
import { createFakeClient } from "./generated/fake.js";
import type { GetBooksQuery } from "./generated/graphql.js";

describe("Fake Registration Benchmark", () => {
    let server: Awaited<ReturnType<typeof createFakeServer>>;
    let fakeClient: ReturnType<typeof createFakeClient>;
    const TEST_PORT = 4001; // Use different port to avoid conflicts

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
                logLevel: "error", // Reduce noise in benchmarks
            }),
        );

        // Start the server
        await server.start();

        // Create fake client
        fakeClient = createFakeClient({
            fakeServerEndpoint: `http://127.0.0.1:${TEST_PORT}/fake`,
        });
    });

    afterAll(async () => {
        await server?.stop();
    });

    describe("Large-scale fake registration", () => {
        // Test with different sizes to identify the threshold
        const testSizes = [10, 50, 100, 200, 500, 1000];

        for (const size of testSizes) {
            bench(
                `Register ${size} fake responses concurrently`,
                async () => {
                    const sequenceId = `bench-${Date.now()}-${Math.random()}`;
                    const promises: Promise<any>[] = [];

                    // Create fake response data
                    const fakeResponse: GetBooksQuery = {
                        books: Array.from({ length: 10 }, (_, i) => ({
                            __typename: "Book" as const,
                            id: `book-${i}`,
                            title: `Benchmark Book ${i}`,
                            author: `Author ${i}`,
                        })),
                    };

                    // Register multiple fakes concurrently
                    for (let i = 0; i < size; i++) {
                        const uniqueSequenceId = `${sequenceId}-${i}`;
                        promises.push(
                            fakeClient.registerGetBooksQueryResponse(
                                uniqueSequenceId,
                                fakeResponse,
                            ),
                        );
                    }

                    // Wait for all registrations to complete
                    const results = await Promise.allSettled(promises);

                    // Check for failures (ECONNRESET errors)
                    const failures = results.filter((r) => r.status === "rejected");
                    if (failures.length > 0) {
                        console.error(`Failed ${failures.length}/${size} registrations`);
                        // Log first error for debugging
                        const firstError = (failures[0] as PromiseRejectedResult).reason;
                        console.error("First error:", firstError);
                    }

                    // All registrations should succeed with the fix
                    if (failures.length > 0) {
                        throw new Error(
                            `${failures.length} registrations failed with ECONNRESET or other errors`,
                        );
                    }
                },
                {
                    iterations: 5, // Run each benchmark 5 times
                    time: 10000, // Allow up to 10 seconds per benchmark
                },
            );
        }

        bench(
            "Register fakes sequentially (baseline)",
            async () => {
                const sequenceId = `bench-seq-${Date.now()}-${Math.random()}`;
                const size = 100;

                const fakeResponse: GetBooksQuery = {
                    books: Array.from({ length: 10 }, (_, i) => ({
                        __typename: "Book" as const,
                        id: `book-${i}`,
                        title: `Sequential Book ${i}`,
                        author: `Author ${i}`,
                    })),
                };

                // Register fakes one by one
                for (let i = 0; i < size; i++) {
                    const uniqueSequenceId = `${sequenceId}-${i}`;
                    await fakeClient.registerGetBooksQueryResponse(uniqueSequenceId, fakeResponse);
                }
            },
            {
                iterations: 5,
                time: 10000,
            },
        );
    });

    describe("Stress test with mixed operations", () => {
        bench(
            "Mixed registration and retrieval (100 operations)",
            async () => {
                const sequenceId = `bench-mixed-${Date.now()}-${Math.random()}`;
                const promises: Promise<any>[] = [];

                const fakeResponse: GetBooksQuery = {
                    books: [
                        {
                            __typename: "Book" as const,
                            id: "stress-book-1",
                            title: "Stress Test Book",
                            author: "Stress Author",
                        },
                    ],
                };

                // Mix registration and retrieval operations
                for (let i = 0; i < 50; i++) {
                    const uniqueSequenceId = `${sequenceId}-${i}`;

                    // Register fake
                    promises.push(
                        fakeClient.registerGetBooksQueryResponse(uniqueSequenceId, fakeResponse),
                    );

                    // Try to retrieve (will fail if not registered yet, but that's ok for stress test)
                    promises.push(
                        fakeClient.calledGetBooksQuery(uniqueSequenceId).catch(() => {
                            // Ignore retrieval errors for stress test
                        }),
                    );
                }

                const results = await Promise.allSettled(promises);
                const registrationResults = results.slice(0, 50); // First 50 are registrations
                const failures = registrationResults.filter((r) => r.status === "rejected");

                if (failures.length > 0) {
                    throw new Error(`${failures.length} operations failed during stress test`);
                }
            },
            {
                iterations: 3,
                time: 15000,
            },
        );
    });

    describe("Performance characteristics", () => {
        bench(
            "Measure throughput with rate limiting (500 requests)",
            async () => {
                const startTime = Date.now();
                const sequenceId = `bench-throughput-${startTime}-${Math.random()}`;
                const size = 500;
                const promises: Promise<any>[] = [];

                const fakeResponse: GetBooksQuery = {
                    books: [
                        {
                            __typename: "Book" as const,
                            id: "throughput-book",
                            title: "Throughput Test",
                            author: "Test Author",
                        },
                    ],
                };

                // Register all at once to test rate limiting
                for (let i = 0; i < size; i++) {
                    const uniqueSequenceId = `${sequenceId}-${i}`;
                    promises.push(
                        fakeClient.registerGetBooksQueryResponse(uniqueSequenceId, fakeResponse),
                    );
                }

                await Promise.all(promises);
                const endTime = Date.now();
                const duration = endTime - startTime;
                const throughput = (size / duration) * 1000; // requests per second

                console.log(`Throughput: ${throughput.toFixed(2)} requests/second`);
                console.log(`Total time: ${duration}ms for ${size} requests`);
            },
            {
                iterations: 3,
                time: 30000, // Allow up to 30 seconds
            },
        );
    });
});
