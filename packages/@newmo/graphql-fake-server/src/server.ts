import fs from "node:fs/promises";
import http from "node:http";
import { isDeepStrictEqual } from "node:util";
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { expressMiddleware } from "@as-integrations/express5";
import { addMocksToSchema } from "@graphql-tools/mock";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { serve } from "@hono/node-server";
import { createMock, type MockObject } from "@newmo/graphql-fake-core";
import corsExpress from "cors";
import express from "express";
import type { GraphQLSchema } from "graphql/index.js";
import { buildSchema } from "graphql/utilities/index.js";
// @ts-expect-error -- no types
import depthLimit from "graphql-depth-limit";
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { proxy } from "hono/proxy";
import type { RequiredFakeServerConfig } from "./config.js";
import { createLogger, type LogLevel } from "./logger.js";

// @ts-expect-error -- biome error
const ENV_HOSTNAME = process.env.HOSTNAME || "0.0.0.0";
export type CreateFakeServerOptions = RequiredFakeServerConfig & {
    logLevel?: LogLevel;
    allowedCORSOrigins: string[];
};

type FakeServerInternal = {
    mockObject: MockObject;
    schema: GraphQLSchema;
    ports: {
        fakeServer: number;
        apolloServer: number;
    };
    maxQueryDepth: number;
    maxFieldRecursionDepth: number;
    maxRegisteredSequences: number;
    logLevel: LogLevel;
    allowedCORSOrigins: string[];
};

/**
 * Custom startStandaloneServer with CORS configuration
 * This restricts CORS to only allow localhost, internal network connections, and specified allowed origins
 */
const startStandaloneServerWithCORS = async (
    server: ApolloServer,
    options: {
        listen: { port: number };
    },
    allowedCORSOrigins: string[] = [],
) => {
    // Create Express app with custom CORS configuration
    const app = express();
    const httpServer = http.createServer(app);

    // Add drain plugin for graceful shutdown
    server.addPlugin(ApolloServerPluginDrainHttpServer({ httpServer }));

    // Ensure server is started
    await server.start();

    // Set up Express middleware with strict CORS that only allows localhost
    app.use(
        "/",
        corsExpress({
            origin: (origin, callback) => {
                // Allow requests with no origin (like mobile apps, curl, etc)
                if (!origin) return callback(null, true);

                // Allow localhost, loopback addresses, and explicitly allowed origins
                if (isLocalRequest(origin)) {
                    return callback(null, true);
                }

                // Allow explicitly allowed origins from configuration
                if (allowedCORSOrigins.includes(origin)) {
                    return callback(null, true);
                }

                // Deny all other origins
                return callback(new Error("Not allowed by CORS"), false);
            },
            methods: ["POST", "GET", "OPTIONS"],
            credentials: false,
        }),
        express.json({ limit: "50mb" }),
        // @ts-expect-error -- express 5 types are not compatible with apollo-server
        expressMiddleware(server, options),
    );

    // Start the server
    const port = options.listen.port ?? 4000;
    await new Promise<void>((resolve) => httpServer.listen({ port }, resolve));

    return {
        url: `http://${ENV_HOSTNAME}:${port}`,
        httpServer,
    };
};

const creteApolloServer = async (options: FakeServerInternal) => {
    const mocks = Object.fromEntries(
        Object.entries(options.mockObject).map(([key, value]) => {
            return [key, () => value];
        }),
    );
    return new ApolloServer({
        schema: addMocksToSchema({
            schema: makeExecutableSchema({
                typeDefs: options.schema,
            }),
            mocks,
        }),
        validationRules: [depthLimit(options.maxQueryDepth)],
    });
};
// Allowed condition types
const ALLOWED_CONDITION_TYPES = ["count", "variables"] as const;
type AllowedConditionType = (typeof ALLOWED_CONDITION_TYPES)[number];

// Condition rules for conditional fake responses
export type ConditionRule =
    | { type: "count"; value: number } // Match based on call count (nth call)
    | { type: "variables"; value: Record<string, any> }; // Match based on complete variables object

// Called result structure for tracking requests/responses
export type CalledResult = {
    requestTimestamp: number;
    request: {
        headers: Record<string, string>;
        body: Record<string, unknown>;
    };
    response: {
        status: number;
        headers: Record<string, string>;
        body: unknown;
    };
};

// Response type for the /called endpoint
export type CalledResultResponse = {
    ok: boolean;
    data: CalledResult[];
};

export type RegisterSequenceNetworkError = {
    type: "network-error";
    operationName: string;
    responseStatusCode: number;
    errors: Record<string, unknown>[];
    // Add condition
    condition?: ConditionRule;
};
export type RegisterSequenceOperation = {
    type: "operation";
    operationName: string;
    data: Record<string, unknown>;
    // Add condition
    condition?: ConditionRule;
};
export type RegisterSequenceOptions = RegisterSequenceNetworkError | RegisterSequenceOperation;

/**
 * Check if two condition types are conflicting
 * Only the following combinations are allowed:
 * - count + count
 * - variables + variables
 * - variables + no condition (undefined)
 * - no condition (undefined) + no condition (undefined)
 * All other combinations are conflicting
 */
const areConditionTypesConflicting = (
    conditionType1: string | undefined,
    conditionType2: string | undefined,
): boolean => {
    // Define allowed combinations
    const allowedCombinations = new Set([
        // Multiple count conditions for the same operation (e.g., 1st call, 2nd call)
        "count,count",
        // Multiple variables conditions for the same operation (e.g., different variable sets)
        "variables,variables",
        // Variables condition can coexist with default fallback
        "variables,undefined",
        // Default fallback can coexist with variables condition
        "undefined,variables",
        // Multiple default conditions - overwrite with the last one
        "undefined,undefined",
    ]);

    const combinationKey = `${conditionType1 ?? "undefined"},${conditionType2 ?? "undefined"}`;

    // If the combination is not in the allowed list, it's conflicting
    return !allowedCombinations.has(combinationKey);
};

/**
 * Get condition type from a RegisterSequenceOptions
 */
const getConditionType = (fake: RegisterSequenceOptions): string | undefined => {
    return fake.condition?.type;
};

/**
 * Check for condition conflicts in existing fakes for the same operation
 */
const checkConditionConflicts = (
    newFake: RegisterSequenceOptions,
    existingConditionalFakes: RegisterSequenceOptions[],
    existingDefaultFake: RegisterSequenceOptions | undefined,
): string[] => {
    const errors: string[] = [];
    const newConditionType = getConditionType(newFake);

    // Check conflicts with existing conditional fakes
    for (const existingFake of existingConditionalFakes) {
        const existingConditionType = getConditionType(existingFake);
        if (areConditionTypesConflicting(newConditionType, existingConditionType)) {
            errors.push(
                `Cannot mix count conditions with ${
                    existingConditionType || "default"
                } conditions for the same operation`,
            );
        }
    }

    // Check conflicts with existing default fake (no condition)
    if (existingDefaultFake) {
        const existingConditionType = getConditionType(existingDefaultFake);
        if (areConditionTypesConflicting(newConditionType, existingConditionType)) {
            errors.push(
                "Cannot mix count conditions with default (no condition) for the same operation",
            );
        }
    }

    return errors;
};

/**
 * Validate condition rule structure
 */
const validateConditionRule = (condition: any): condition is ConditionRule => {
    if (typeof condition !== "object" || condition === null) return false;

    if (!("type" in condition) || typeof condition.type !== "string") return false;

    // Check if type is in the allow list
    if (!ALLOWED_CONDITION_TYPES.includes(condition.type as AllowedConditionType)) {
        return false;
    }

    switch (condition.type) {
        case "count":
            return (
                "value" in condition && typeof condition.value === "number" && condition.value > 0
            );

        case "variables":
            return (
                "value" in condition &&
                typeof condition.value === "object" &&
                condition.value !== null &&
                !Array.isArray(condition.value)
            );

        default:
            return false;
    }
};

const validateSequenceRegistration = (data: unknown): data is RegisterSequenceOptions => {
    if (typeof data !== "object" || data === null) return false;

    // Validate condition
    if ("condition" in data && data.condition !== undefined) {
        if (!validateConditionRule(data.condition)) return false;
    }

    if ("type" in data && typeof data.type === "string") {
        if (data.type === "network-error") {
            return (
                "errors" in data &&
                Array.isArray(data.errors) &&
                "responseStatusCode" in data &&
                typeof data.responseStatusCode === "number" &&
                "operationName" in data &&
                typeof data.operationName === "string"
            );
        }
        if (data.type === "operation") {
            return (
                "data" in data &&
                typeof data.data === "object" &&
                "operationName" in data &&
                typeof data.operationName === "string"
            );
        }
    }
    return false;
};

class LRUMap<K, V> {
    private map = new Map<K, V>();
    private keys: K[] = [];
    private maxSize: number;

    constructor({ maxSize }: { maxSize: number }) {
        this.maxSize = maxSize;
    }

    set(key: K, value: V) {
        this.map.set(key, value);
        this.keys.push(key);
        if (this.keys.length > this.maxSize) {
            const oldestKey = this.keys.shift();
            if (oldestKey) {
                this.map.delete(oldestKey);
            }
        }
    }

    get(key: K): V | undefined {
        return this.map.get(key);
    }
}

// Map key is sequenceId x operationName
// allow to register multiple operations with the same sequenceId at the same time
// However, sequenceId x operationName must be unique
// If the same sequenceId x operationName is registered, the previous one is overwritten
const createMapKey = ({
    sequenceId,
    operationName,
}: {
    sequenceId: string;
    operationName: string;
}) => {
    return `${sequenceId}.${operationName}`;
};

// Extension to manage conditional fakes
const _createConditionalMapKey = ({
    sequenceId,
    operationName,
    conditionHash,
}: {
    sequenceId: string;
    operationName: string;
    conditionHash?: string;
}) => {
    if (conditionHash) {
        return `${sequenceId}.${operationName}.${conditionHash}`;
    }
    return `${sequenceId}.${operationName}`;
};

// Generate hash value for condition (same condition produces same hash)
const _hashCondition = (condition: ConditionRule): string => {
    return Buffer.from(JSON.stringify(condition)).toString("base64");
};

// Private IP address ranges defined in RFC 1918
// See: https://www.rfc-editor.org/rfc/rfc1918
const privateIPRanges = [
    /^192\.168\.\d{1,3}\.\d{1,3}$/, // 192.168.0.0/16
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // 10.0.0.0/8
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/, // 172.16.0.0/12
];
/**
 * Check if the origin is a local address
 * @param origin
 */
const isLocalRequest = (origin: string | null): boolean => {
    if (!origin) return false;
    try {
        const url = new URL(origin);
        const hostname = url.hostname;
        // localhost and 127.0.0.1 are standard local addresses
        if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === ENV_HOSTNAME) {
            return true;
        }
        return privateIPRanges.some((range) => range.test(hostname));
    } catch {
        return false;
    }
};

const createRoutingServer = async ({
    logLevel,
    ports,
    maxRegisteredSequences,
    allowedCORSOrigins,
}: {
    logLevel: LogLevel;
    maxRegisteredSequences: number;
    ports: {
        fakeServer: number;
        apolloServer: number;
    };
    allowedCORSOrigins: string[];
}) => {
    const logger = createLogger(logLevel);
    const app = new Hono();
    // pass through to apollo server
    const passToApollo = async (c: Context) => {
        logger.debug("passToApollo: starting");
        // remove prefix
        // prefix = /app1/*, path = /app1/a/b
        // => suffix_path = /a/b
        // let path = new URL(c.req.raw.url).pathname
        let path = c.req.path;
        logger.debug("passToApollo: got path", {
            path,
            routePath: c.req.routePath,
        });
        path = path.replace(new RegExp(`^${c.req.routePath.replace("*", "")}`), "/");
        let url = `http://${ENV_HOSTNAME}:${ports.apolloServer}${path}`;
        // add params to URL
        if (c.req.query()) url = `${url}?${new URLSearchParams(c.req.query())}`;
        logger.debug("passToApollo: built URL", { url });

        const sequenceId = c.req.header("sequence-id");
        logger.debug("passToApollo: getting request body", { sequenceId });

        const requestBody = await c.req.raw.clone().json();
        logger.debug("passToApollo: got request body", { requestBody });

        const operationName =
            typeof requestBody === "object" &&
            requestBody !== null &&
            "operationName" in requestBody
                ? requestBody.operationName
                : undefined;

        // request
        logger.debug("passToApollo: calling proxy", {
            url,
            sequenceId,
            operationName,
            headers: c.req.header(),
        });

        const proxyResponse = await proxy(url, {
            raw: c.req.raw,
            headers: {
                ...c.req.header(),
            },
        });

        logger.debug("passToApollo: proxy call completed", {
            sequenceId,
            operationName,
            status: proxyResponse.status,
            headers: Object.fromEntries(proxyResponse.headers),
        });

        // log response with pipe
        if (proxyResponse.status === 101) return proxyResponse;

        // save request and response for /called api
        if (sequenceId && typeof operationName === "string") {
            logger.debug("passToApollo: getting response body for caching");
            const responseBody = (await proxyResponse.clone().json()) as Record<string, unknown>;
            logger.debug("passToApollo: parsed response body", {
                responseBody,
            });

            const cacheKey = createMapKey({
                sequenceId,
                operationName,
            });
            logger.debug("save called result", {
                sequenceId,
                operationName,
                cacheKey,
            });

            sequenceCalledResultLruMap.set(cacheKey, [
                ...(sequenceCalledResultLruMap.get(cacheKey) ?? []),
                {
                    requestTimestamp: Date.now(),
                    request: {
                        headers: Object.fromEntries(c.req.raw.headers),
                        body: requestBody as Record<string, unknown>,
                    },
                    response: {
                        status: proxyResponse.status,
                        headers: Object.fromEntries(proxyResponse.headers),
                        body: responseBody,
                    },
                },
            ]);
        }

        logger.debug("passToApollo: returning proxy response", {
            sequenceId,
            operationName,
            status: proxyResponse.status,
        });
        return proxyResponse;
    };
    // sequenceId x operationName -> FakeResponse
    const sequenceFakeResponseLruMap = new LRUMap<string, RegisterSequenceOptions>({
        maxSize: maxRegisteredSequences,
    });
    // Manage conditional fake responses (store multiple conditional responses)
    const conditionalFakeResponseMap = new LRUMap<string, RegisterSequenceOptions[]>({
        maxSize: maxRegisteredSequences,
    });
    // Track call count
    const callCountMap = new LRUMap<string, number>({
        maxSize: maxRegisteredSequences,
    });
    // sequenceId x operationName -> Called Result
    // CalledResult is first request is index 0, second request is index 1 and so on
    const sequenceCalledResultLruMap = new LRUMap<string, CalledResult[]>({
        maxSize: maxRegisteredSequences,
    });
    // /fake api does not support CORS
    // because it allows any user to modify the response
    // If you need to support CORS, implement with checking the origin or something
    app.post("/fake", async (c) => {
        logger.debug("/fake");
        const sequenceId = c.req.header("sequence-id");
        if (!sequenceId) {
            return Response.json(
                JSON.stringify({
                    ok: false,
                    errors: ["sequence-id is required"],
                }),
                {
                    status: 400,
                },
            );
        }
        const body = await c.req.json();
        logger.debug("/fake: got fake body", {
            sequenceId,
            body,
        });
        if (!validateSequenceRegistration(body)) {
            return Response.json(JSON.stringify({ ok: false, errors: ["invalid fake body"] }), {
                status: 400,
            });
        }
        const operationName = body.operationName;
        logger.debug("/fake got body type", {
            sequenceId,
            type: body.type,
            condition: body.condition,
        });

        const baseKey = createMapKey({
            sequenceId,
            operationName,
        });

        // Check for condition conflicts before registration
        const existingConditionalFakes = conditionalFakeResponseMap.get(baseKey) || [];
        const existingDefaultFake = sequenceFakeResponseLruMap.get(baseKey);

        const conflictErrors = checkConditionConflicts(
            body,
            existingConditionalFakes,
            existingDefaultFake,
        );

        if (conflictErrors.length > 0) {
            return Response.json(
                { ok: false, errors: conflictErrors },
                {
                    status: 400,
                },
            );
        }

        // Register as conditional fake if condition exists
        if (body.condition) {
            const existingConditionalFakes = conditionalFakeResponseMap.get(baseKey) || [];
            // Overwrite if same condition exists, otherwise add new
            const existingIndex = existingConditionalFakes.findIndex(
                (fake) =>
                    fake.condition &&
                    JSON.stringify(fake.condition) === JSON.stringify(body.condition),
            );

            if (existingIndex >= 0) {
                existingConditionalFakes[existingIndex] = body;
            } else {
                existingConditionalFakes.push(body);
            }

            // Sort by condition specificity (evaluate more specific conditions first)
            existingConditionalFakes.sort((a, b) => {
                const scoreA = a.condition ? calculateConditionSpecificity(a.condition) : 0;
                const scoreB = b.condition ? calculateConditionSpecificity(b.condition) : 0;
                return scoreB - scoreA; // Descending order
            });

            conditionalFakeResponseMap.set(baseKey, existingConditionalFakes);
        } else {
            // Without condition, use traditional approach
            sequenceFakeResponseLruMap.set(baseKey, body);
        }
        return Response.json(
            { ok: true },
            {
                status: 200,
            },
        );
    });
    app.use("/fake/called", async (c) => {
        // Return CalledResult matching sequenceId x operationName
        const sequenceId = c.req.header("sequence-id");
        if (!sequenceId) {
            return Response.json(
                JSON.stringify({
                    ok: false,
                    errors: ["sequence-id is required"],
                }),
                {
                    status: 400,
                },
            );
        }
        // Get operationName from req.body
        const body = await c.req.json();
        const operationName = body.operationName;
        if (!operationName) {
            return Response.json(
                JSON.stringify({
                    ok: false,
                    errors: ["operationName is required"],
                }),
                {
                    status: 400,
                },
            );
        }
        const key = createMapKey({
            sequenceId,
            operationName,
        });
        // if not found, return empty array
        const result = sequenceCalledResultLruMap.get(key);
        if (!result) {
            return Response.json(
                { ok: true, data: [] },
                {
                    status: 200,
                },
            );
        }
        return Response.json(
            { ok: true, data: result },
            {
                status: 200,
            },
        );
    });
    const fakeGraphQLQuery = async (c: Context) => {
        logger.debug("fakeGraphQLQuery: starting");
        const _requestTimestamp = Date.now();
        /**
         * Steps:
         * 1. Receive a request for a GraphQL query
         * 2. Does it contain a sequence id?
         *    - if Yes: type is network error → return an error
         *    - if No: Pass through to Apollo Server -> exit
         * 3. Send a request to Apollo Server
         * 4. Merge the registration data with the response from 3
         * 5. Return the merged data
         */
        const sequenceId = c.req.header("sequence-id");

        logger.debug("fakeGraphQLQuery: getting request body", { sequenceId });
        const requestBody = await c.req.raw.clone().json();
        logger.debug("fakeGraphQLQuery: got request body", {
            requestBody,
        });

        const requestOperationName =
            typeof requestBody === "object" &&
            requestBody !== null &&
            "operationName" in requestBody &&
            requestBody.operationName &&
            typeof requestBody.operationName === "string"
                ? requestBody.operationName
                : undefined;
        logger.debug(
            `fakeGraphQLQuery: operationName: ${requestOperationName} sequenceId: ${sequenceId}`,
            {
                sequenceId,
            },
        );
        // 2. Does it contain a sequence id?
        if (!sequenceId) {
            logger.debug("fakeGraphQLQuery: no sequenceId, passing to Apollo");
            return passToApollo(c);
        }
        if (!requestOperationName) {
            logger.debug("fakeGraphQLQuery: no operationName, passing to Apollo");
            return passToApollo(c);
        }

        const baseKey = createMapKey({
            sequenceId,
            operationName: requestOperationName,
        });

        // Increment call count
        const currentCallCount = (callCountMap.get(baseKey) || 0) + 1;
        callCountMap.set(baseKey, currentCallCount);

        // Get request variables
        const requestVariables =
            typeof requestBody === "object" &&
            requestBody !== null &&
            "variables" in requestBody &&
            typeof requestBody.variables === "object" &&
            requestBody.variables !== null
                ? (requestBody.variables as Record<string, any>)
                : undefined;

        // Check conditional fakes first
        const conditionalFakes = conditionalFakeResponseMap.get(baseKey);
        let matchedFake: RegisterSequenceOptions | undefined;

        if (conditionalFakes && conditionalFakes.length > 0) {
            // Find matching fake (already sorted by specificity in descending order)
            for (const fake of conditionalFakes) {
                if (fake.condition) {
                    const context = {
                        callCount: currentCallCount,
                        ...(requestVariables && { variables: requestVariables }),
                    };

                    if (evaluateCondition(fake.condition, context)) {
                        matchedFake = fake;
                        logger.debug("fakeGraphQLQuery: matched conditional fake", {
                            sequenceId,
                            operationName: requestOperationName,
                            condition: fake.condition,
                            callCount: currentCallCount,
                            variables: requestVariables,
                        });
                        break;
                    }
                }
            }
        }

        // If no conditional fake is found, try the traditional method
        if (!matchedFake) {
            matchedFake = sequenceFakeResponseLruMap.get(baseKey);
        }

        logger.debug(
            `fakeGraphQLQuery: sequence-id: ${sequenceId} x operationName: ${requestOperationName}, fake exists: ${Boolean(
                matchedFake,
            )}`,
            {
                matchedFake,
                sequenceId,
                operationName: requestOperationName,
                callCount: currentCallCount,
            },
        );

        if (!matchedFake) {
            logger.debug("fakeGraphQLQuery: no fake found, passing to Apollo");
            return passToApollo(c);
        }

        if (requestOperationName !== matchedFake.operationName) {
            logger.debug("fakeGraphQLQuery: operationName mismatch, returning error");
            return Response.json(
                JSON.stringify({
                    errors: [
                        `operationName does not match. operationName: ${requestOperationName} sequenceId: ${sequenceId}`,
                    ],
                }),
                {
                    status: 400,
                },
            );
        }

        if (matchedFake.type === "network-error") {
            logger.debug("fakeGraphQLQuery: network-error type, returning error");
            return new Response(
                JSON.stringify({
                    errors: matchedFake.errors,
                }),
                {
                    status: matchedFake.responseStatusCode,
                },
            );
        }

        // 3. Send a request to Apollo Server
        logger.debug("fakeGraphQLQuery: sending request to apollo server", {
            sequenceId,
        });

        const proxyResponse = await proxy(`http://${ENV_HOSTNAME}:${ports.apolloServer}/graphql`, {
            raw: c.req.raw,
            headers: {
                ...c.req.header(),
            },
        });

        logger.debug("fakeGraphQLQuery: apollo server response completed", {
            sequenceId,
            status: proxyResponse.status,
            headers: Object.fromEntries(proxyResponse.headers),
        });

        if (proxyResponse.status === 101) return proxyResponse;

        // 4. Get response body
        logger.debug("fakeGraphQLQuery: getting response body");
        const responseBody = (await proxyResponse.json()) as Record<string, unknown>;
        logger.debug("fakeGraphQLQuery: parsed response body", {
            responseBody,
        });

        // 5. Merge the registration data with the response
        const data = matchedFake.data;
        logger.debug(`fakeGraphQLQuery: starting data merge sequence-id: ${sequenceId}`, {
            data,
            responseBody,
        });
        // Use bracket notation for properties from index signature
        const responseData = responseBody["data"] as any;
        const merged = {
            ...(typeof responseData === "object" && responseData !== null ? responseData : {}),
            ...data,
        };

        const cacheKey = createMapKey({
            sequenceId,
            operationName: requestOperationName,
        });
        sequenceCalledResultLruMap.set(cacheKey, [
            ...(sequenceCalledResultLruMap.get(cacheKey) ?? []),
            {
                requestTimestamp: Date.now(),
                request: {
                    headers: Object.fromEntries(c.req.raw.headers),
                    body: requestBody as Record<string, unknown>,
                },
                response: {
                    status: proxyResponse.status,
                    headers: Object.fromEntries(proxyResponse.headers),
                    body: {
                        data: merged,
                    },
                },
            },
        ]);

        logger.debug("fakeGraphQLQuery: merge completed, returning response");
        // "content-length" should be matched from the response body length
        const responseJson = JSON.stringify({ data: merged });
        return new Response(responseJson, {
            status: proxyResponse.status,
            headers: {
                "Content-Type": "application/json",
                "Content-Length": responseJson.length.toString(),
            },
        });
    };
    // graphql api is for browser and need to support CORS
    app.use(
        "/graphql",
        cors({
            origin: (origin) => {
                if (isLocalRequest(origin)) {
                    return origin;
                }
                if (origin && allowedCORSOrigins.includes(origin)) {
                    return origin;
                }
                return null;
            },
        }),
    );
    app.use(
        "/query",
        cors({
            origin: (origin) => {
                if (isLocalRequest(origin)) {
                    return origin;
                }
                if (origin && allowedCORSOrigins.includes(origin)) {
                    return origin;
                }
                return null;
            },
        }),
    );
    app.use("/graphql", fakeGraphQLQuery);
    app.use("/query", fakeGraphQLQuery);
    app.all("*", passToApollo);
    return app;
};
export const createFakeServer = async (options: CreateFakeServerOptions) => {
    const {
        logLevel,
        maxFieldRecursionDepth,
        maxQueryDepth,
        maxRegisteredSequences,
        ports,
        schemaFilePath,
        defaultValues,
        allowedCORSOrigins,
    } = options;
    const logger = createLogger(logLevel);
    const schema = buildSchema(await fs.readFile(schemaFilePath, "utf-8"));
    const mockResult = await createMock({
        schema,
        maxFieldRecursionDepth,
        defaultValues,
    });
    if (!mockResult.ok) {
        logger.error("Failed to create mock data", mockResult);
        throw new Error("Failed to create mock data", {
            cause: mockResult.error,
        });
    }
    logger.debug("created mock code", mockResult.code);
    logger.debug("created mock data", mockResult.mock);
    return createFakeServerInternal({
        ports,
        schema,
        mockObject: mockResult.mock,
        maxQueryDepth,
        maxFieldRecursionDepth,
        maxRegisteredSequences,
        logLevel: logLevel ?? "info",
        allowedCORSOrigins,
    });
};

export const createFakeServerInternal = async (options: FakeServerInternal) => {
    const apolloServer = await creteApolloServer(options);
    const routingServer = await createRoutingServer({
        logLevel: options.logLevel,
        ports: options.ports,
        maxRegisteredSequences: options.maxRegisteredSequences,
        allowedCORSOrigins: options.allowedCORSOrigins,
    });
    let routerServer: ReturnType<typeof serve> | null = null;
    return {
        start: async () => {
            // Replace startStandaloneServer with our custom implementation
            await startStandaloneServerWithCORS(
                apolloServer,
                {
                    listen: { port: options.ports.apolloServer },
                },
                options.allowedCORSOrigins,
            );
            routerServer = serve({
                fetch: routingServer.fetch,
                port: options.ports.fakeServer,
            });
            return {
                urls: {
                    fakeServer: `http://${ENV_HOSTNAME}:${options.ports.fakeServer}`,
                    apolloServer: `http://${ENV_HOSTNAME}:${options.ports.apolloServer}`,
                },
            };
        },
        stop: () => {
            apolloServer.stop();
            routerServer?.close();
        },
    };
};

/**
 * Check if condition rule matches the current request context
 */
const evaluateCondition = (
    condition: ConditionRule,
    context: {
        callCount: number;
        variables?: Record<string, any>;
    },
): boolean => {
    switch (condition.type) {
        case "count":
            return context.callCount === condition.value;

        case "variables":
            if (!context.variables) return false;
            return isDeepStrictEqual(context.variables, condition.value);

        default:
            return false;
    }
};

/**
 * Calculate condition specificity score (used for matching priority)
 */
const calculateConditionSpecificity = (condition: ConditionRule): number => {
    switch (condition.type) {
        case "count":
            return 10; // count conditions have medium priority

        case "variables":
            return 20; // variables conditions have high priority

        default:
            return 0;
    }
};
