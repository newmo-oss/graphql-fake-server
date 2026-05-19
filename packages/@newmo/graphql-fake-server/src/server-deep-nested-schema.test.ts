import assert from "node:assert";
import { createMock, extendSchema } from "@newmo/graphql-fake-core";
import { buildSchema } from "graphql/utilities/index.js";
import { describe, expect, it } from "vitest";
import { createFakeServerInternal } from "./server.js";

let portCounter = 100;
const getPorts = () => {
    portCounter += 2;
    return {
        fakeServer: 5000 + portCounter,
        apolloServer: 5001 + portCounter,
    };
};

type GraphQLResponse = {
    data?: any;
    errors?: Array<{ message: string }>;
};

/**
 * Deep nested schema test: mock generation memory issue.
 *
 * With maxDepth: 9, listLength: 3, each type having 2 list fields:
 * Each level generates (2 * 3) = 6 child objects per parent.
 * Total objects ≈ 6^9 = 10,077,696 — causes OOM when eagerly expanded at startup.
 *
 * This test verifies that the server can handle deeply nested schemas
 * without running out of memory by generating mock data lazily at request time.
 */
describe("deep nested schema: should not OOM on eager mock generation", () => {
    // 10 levels deep, each type has 2 list fields pointing to the next level
    // With maxDepth:9, listLength:3, eager generation creates 6^9 ≈ 10M objects
    const deepNestedSchema = `
        type Query {
            organizations: [Organization!]!
        }

        type Organization {
            id: ID!
            name: String!
            divisions: [Division!]!
            subsidiaries: [Division!]!
        }

        type Division {
            id: ID!
            name: String!
            departments: [Department!]!
            branches: [Department!]!
        }

        type Department {
            id: ID!
            name: String!
            teams: [Team!]!
            workgroups: [Team!]!
        }

        type Team {
            id: ID!
            name: String!
            members: [Employee!]!
            contractors: [Employee!]!
        }

        type Employee {
            id: ID!
            name: String!
            projects: [Project!]!
            reviews: [Project!]!
        }

        type Project {
            id: ID!
            name: String!
            milestones: [Milestone!]!
            releases: [Milestone!]!
        }

        type Milestone {
            id: ID!
            name: String!
            tasks: [Task!]!
            bugs: [Task!]!
        }

        type Task {
            id: ID!
            title: String!
            subtasks: [SubTask!]!
            blockers: [SubTask!]!
        }

        type SubTask {
            id: ID!
            title: String!
            comments: [Comment!]!
            attachments: [Comment!]!
        }

        type Comment {
            id: ID!
            body: String!
        }
    `;

    const startDeepNestedTestServer = async () => {
        const schema = buildSchema(extendSchema(deepNestedSchema));
        const mockResult = await createMock({
            schema,
            mock: {
                maxDepth: 9,
                maxTypeRecursion: 2,
                listLength: 3,
            },
        });
        if (!mockResult.ok) {
            throw new Error("Failed to create mock server.", {
                cause: mockResult.error,
            });
        }
        const ports = getPorts();
        const server = await createFakeServerInternal({
            schema,
            mockFactories: mockResult.factories,
            emptyListFields: mockResult.emptyListFields,
            logLevel: "info",
            ports,
            maxQueryDepth: 12, // Allow deep queries for testing
            maxRegisteredSequences: 100,
            listLength: 3,
            allowedCORSOrigins: [],
            allowedHosts: "auto",
        });
        return server;
    };

    it("should start server without OOM on deeply nested schema", async () => {
        const server = await startDeepNestedTestServer();
        const { urls } = await server.start();

        // Simple shallow query should work
        const response = await fetch(`${urls.fakeServer}/graphql`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "sequence-id": "deep-nested-test-1",
            },
            body: JSON.stringify({
                query: `
                    query ShallowQuery {
                        organizations {
                            id
                            name
                        }
                    }
                `,
            }),
        });
        const result = (await response.json()) as GraphQLResponse;
        assert(result.data, "response should have data");
        assert(Array.isArray(result.data.organizations), "organizations should be an array");
        await server.stop();
    });

    it("should return correct deeply nested data on request", async () => {
        const server = await startDeepNestedTestServer();
        const { urls } = await server.start();

        const response = await fetch(`${urls.fakeServer}/graphql`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "sequence-id": "deep-nested-test-2",
            },
            body: JSON.stringify({
                query: `
                    query DeepQuery {
                        organizations {
                            id
                            name
                            divisions {
                                id
                                name
                                departments {
                                    id
                                    name
                                    teams {
                                        id
                                        name
                                        members {
                                            id
                                            name
                                            projects {
                                                id
                                                name
                                                milestones {
                                                    id
                                                    name
                                                    tasks {
                                                        id
                                                        title
                                                        subtasks {
                                                            id
                                                            title
                                                            comments {
                                                                id
                                                                body
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                `,
            }),
        });
        const result = (await response.json()) as GraphQLResponse;
        assert(result.data, "response should have data");
        assert(Array.isArray(result.data.organizations), "organizations should be an array");
        // Verify nested structure exists
        const orgs = result.data.organizations as any[];
        const org = orgs[0];
        assert(org, "should have at least one organization");
        expect(org.id).toBeDefined();
        expect(org.name).toBeDefined();
        const divisions = org.divisions as any[];
        assert(Array.isArray(divisions), "divisions should be an array");
        assert(divisions.length > 0, "should have at least one division");
        await server.stop();
    });

    it("should return structurally consistent results for the same query", async () => {
        const server = await startDeepNestedTestServer();
        const { urls } = await server.start();

        const query = `
            query ConsistencyCheck {
                organizations {
                    id
                    name
                    divisions {
                        id
                        name
                    }
                }
            }
        `;

        const response1 = await fetch(`${urls.fakeServer}/graphql`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "sequence-id": "deep-nested-test-3a",
            },
            body: JSON.stringify({ query }),
        });
        const result1 = (await response1.json()) as GraphQLResponse;

        const response2 = await fetch(`${urls.fakeServer}/graphql`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "sequence-id": "deep-nested-test-3b",
            },
            body: JSON.stringify({ query }),
        });
        const result2 = (await response2.json()) as GraphQLResponse;

        // Both queries should return same structure (list lengths, field names)
        assert(result1.data, "result1 should have data");
        assert(result2.data, "result2 should have data");
        const orgs1 = result1.data.organizations as any[];
        const orgs2 = result2.data.organizations as any[];
        expect(orgs1.length).toBe(orgs2.length);
        expect(Object.keys(orgs1[0]).sort()).toStrictEqual(Object.keys(orgs2[0]).sort());
        const divs1 = orgs1[0].divisions as any[];
        const divs2 = orgs2[0].divisions as any[];
        expect(divs1.length).toBe(divs2.length);
        await server.stop();
    });
});
