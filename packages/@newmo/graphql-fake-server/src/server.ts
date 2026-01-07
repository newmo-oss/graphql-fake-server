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
const ALLOWED_CONDITION_TYPES = ["always", "variables"] as const;
type AllowedConditionType = (typeof ALLOWED_CONDITION_TYPES)[number];

// Validation result type for better error messages
type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string };

// Condition rules for conditional fake responses
export type ConditionRule =
    | {
          type: "always";
      } // Always match (default condition)
    | {
          type: "variables";
          value: Record<string, unknown>;
      }; // Match based on complete variables object

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
    // Request condition is now required (defaults to "always" if not specified)
    requestCondition: ConditionRule;
};
export type RegisterSequenceOperation = {
    type: "operation";
    operationName: string;
    data: Record<string, unknown>;
    // Request condition is now required (defaults to "always" if not specified)
    requestCondition: ConditionRule;
};
export type RegisterSequenceOptions = RegisterSequenceNetworkError | RegisterSequenceOperation;

/**
 * Validate condition rule structure
 */
const validateConditionRule = (condition: unknown): ValidationResult<ConditionRule> => {
    if (typeof condition !== "object" || condition === null) {
        return { ok: false, error: "Condition must be an object" };
    }

    if (!("type" in condition) || typeof condition.type !== "string") {
        return {
            ok: false,
            error: "Condition must have a 'type' field of type string",
        };
    }

    // Check if type is in the allow list
    if (!ALLOWED_CONDITION_TYPES.includes(condition.type as AllowedConditionType)) {
        return {
            ok: false,
            error: `Unknown condition type '${
                condition.type
            }'. Allowed types: ${ALLOWED_CONDITION_TYPES.join(", ")}`,
        };
    }

    switch (condition.type) {
        case "always":
            // Always condition doesn't need a value
            return { ok: true, data: condition as ConditionRule };

        case "variables":
            if (!("value" in condition)) {
                return { ok: false, error: "Variables condition must have a 'value' field" };
            }
            if (typeof condition.value !== "object" || condition.value === null) {
                return {
                    ok: false,
                    error: "Variables condition value must be an object",
                };
            }
            if (Array.isArray(condition.value)) {
                return {
                    ok: false,
                    error: "Variables condition value must be an object, not an array",
                };
            }
            return { ok: true, data: condition as ConditionRule };

        default:
            return {
                ok: false,
                error: `Unsupported condition type '${condition.type}'`,
            };
    }
};

const validateSequenceRegistration = (data: unknown): ValidationResult<RegisterSequenceOptions> => {
    if (typeof data !== "object" || data === null) {
        return { ok: false, error: "Request body must be an object" };
    }

    // Validate request condition (default to "always" if not provided)
    const requestCondition =
        "requestCondition" in data ? data.requestCondition : { type: "always" };

    if (requestCondition !== undefined) {
        const conditionResult = validateConditionRule(requestCondition);
        if (!conditionResult.ok) {
            return {
                ok: false,
                error: `Invalid request conditions: ${conditionResult.error}`,
            };
        }
        return {
            ok: true,
            data: {
                ...data,
                requestCondition: conditionResult.data,
            } as RegisterSequenceOptions,
        };
    }

    if (!("type" in data) || typeof data.type !== "string") {
        return {
            ok: false,
            error: "Request body must have a 'type' field of type string",
        };
    }

    if (!("operationName" in data) || typeof data.operationName !== "string") {
        return {
            ok: false,
            error: "Request body must have an 'operationName' field of type string",
        };
    }

    if (data.type === "network-error") {
        if (!("errors" in data) || !Array.isArray(data.errors)) {
            return {
                ok: false,
                error: "Network error type must have an 'errors' field of type array",
            };
        }
        if (!("responseStatusCode" in data) || typeof data.responseStatusCode !== "number") {
            return {
                ok: false,
                error: "Network error type must have a 'responseStatusCode' field of type number",
            };
        }
        return { ok: true, data: data as RegisterSequenceOptions };
    }

    if (data.type === "operation") {
        if (!("data" in data) || typeof data.data !== "object" || data.data === null) {
            return {
                ok: false,
                error: "Operation type must have a 'data' field of type object",
            };
        }
        if (Array.isArray(data.data)) {
            return {
                ok: false,
                error: "Array responses are no longer supported. Use single object responses instead.",
            };
        }
        return { ok: true, data: data as RegisterSequenceOptions };
    }

    return {
        ok: false,
        error: `Unknown request type '${data.type}'. Allowed types: 'operation', 'network-error'`,
    };
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
                {
                    ok: false,
                    errors: ["sequence-id is required"],
                },
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
        const validationResult = validateSequenceRegistration(body);
        if (!validationResult.ok) {
            return Response.json(
                { ok: false, errors: [validationResult.error] },
                {
                    status: 400,
                },
            );
        }
        const operationName = validationResult.data.operationName;
        logger.debug("/fake got body type", {
            sequenceId,
            type: validationResult.data.type,
            requestCondition: validationResult.data.requestCondition,
        });

        const baseKey = createMapKey({
            sequenceId,
            operationName,
        });

        // Determine if this has specific conditions (not just "always")
        const hasSpecificConditions = validationResult.data.requestCondition.type !== "always";

        if (hasSpecificConditions) {
            const existingConditionalFakes = conditionalFakeResponseMap.get(baseKey) || [];
            // Overwrite if same condition exists, otherwise add new
            const existingIndex = existingConditionalFakes.findIndex(
                (fake) =>
                    JSON.stringify(fake.requestCondition) ===
                    JSON.stringify(validationResult.data.requestCondition),
            );

            if (existingIndex >= 0) {
                existingConditionalFakes[existingIndex] = validationResult.data;
            } else {
                existingConditionalFakes.push(validationResult.data);
            }

            // Sort by condition specificity for deterministic ordering
            existingConditionalFakes.sort((a, b) => {
                const scoreA = calculateConditionSpecificity(a.requestCondition);
                const scoreB = calculateConditionSpecificity(b.requestCondition);

                // Sort by specificity (descending)
                return scoreB - scoreA;
            });

            conditionalFakeResponseMap.set(baseKey, existingConditionalFakes);
        } else {
            // Without condition or with "always" condition, use traditional approach
            sequenceFakeResponseLruMap.set(baseKey, validationResult.data);
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
                {
                    ok: false,
                    errors: ["sequence-id is required"],
                },
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
                {
                    ok: false,
                    errors: ["operationName is required"],
                },
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
         * 3. Return the fake data directly
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

        // Get request variables
        const requestVariables =
            typeof requestBody === "object" &&
            requestBody !== null &&
            "variables" in requestBody &&
            typeof requestBody.variables === "object" &&
            requestBody.variables !== null
                ? (requestBody.variables as Record<string, unknown>)
                : undefined;

        // Check conditional fakes first
        const conditionalFakes = conditionalFakeResponseMap.get(baseKey);

        logger.debug("fakeGraphQLQuery: conditional fakes check", {
            sequenceId,
            operationName: requestOperationName,
            conditionalFakesCount: conditionalFakes?.length || 0,
            conditionalFakes: conditionalFakes?.map((fake) => ({
                type: fake.type,
                requestCondition: fake.requestCondition,
            })),
            requestVariables,
        });
        // Find the first matching conditional fake based on variables
        // If no conditional fake matches, use the default fake from sequenceFakeResponseLruMap
        const matchedFake: RegisterSequenceOptions | undefined =
            findMatchedConditionalFake({
                conditionalFakes: conditionalFakes,
                requestVariables: requestVariables,
                logger: logger,
                sequenceId: sequenceId,
                requestOperationName: requestOperationName,
            }) ?? sequenceFakeResponseLruMap.get(baseKey);

        logger.debug(
            `fakeGraphQLQuery: sequence-id: ${sequenceId} x operationName: ${requestOperationName}, fake exists: ${Boolean(
                matchedFake,
            )}`,
            {
                matchedFake,
                sequenceId,
                operationName: requestOperationName,
            },
        );

        if (!matchedFake) {
            logger.debug("fakeGraphQLQuery: no fake found, passing to Apollo");
            return passToApollo(c);
        }

        if (requestOperationName !== matchedFake.operationName) {
            logger.debug("fakeGraphQLQuery: operationName mismatch, returning error");
            return Response.json(
                {
                    errors: [
                        `operationName does not match. operationName: ${requestOperationName} sequenceId: ${sequenceId}`,
                    ],
                },
                {
                    status: 400,
                },
            );
        }

        if (matchedFake.type === "network-error") {
            logger.debug("fakeGraphQLQuery: network-error type, returning error");

            // Record call history for error responses as well
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
                        status: matchedFake.responseStatusCode,
                        headers: { "Content-Type": "application/json" },
                        body: {
                            errors: matchedFake.errors,
                        },
                    },
                },
            ]);

            return new Response(
                JSON.stringify({
                    errors: matchedFake.errors,
                }),
                {
                    status: matchedFake.responseStatusCode,
                },
            );
        }

        // 3. Return the fake data directly (no need to call Apollo Server)
        const fakeData = matchedFake.data;
        logger.debug(`fakeGraphQLQuery: returning fake data sequence-id: ${sequenceId}`, {
            fakeData,
        });

        // Handle single response
        const responseData = fakeData;

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
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                    body: {
                        data: responseData,
                    },
                },
            },
        ]);

        logger.debug("fakeGraphQLQuery: returning fake response");
        // Let the server automatically calculate Content-Length to avoid issues with multi-byte characters
        const responseJson = JSON.stringify({ data: responseData });
        return new Response(responseJson, {
            status: 200,
            headers: {
                "Content-Type": "application/json",
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
    app.all("*", (c) => passToApollo(c));
    return app;
};
export const createFakeServer = async (options: CreateFakeServerOptions) => {
    const {
        logLevel,
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
        variables?: Record<string, unknown>;
    },
): boolean => {
    switch (condition.type) {
        case "always":
            return true;

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
        case "always":
            return 0; // always conditions have lowest priority

        case "variables":
            return 20; // variables conditions have high priority

        default:
            return 0;
    }
};

/**
 * Find a matching conditional fake based on the request variables
 */
const findMatchedConditionalFake = ({
    conditionalFakes,
    requestVariables,
    logger,
    sequenceId,
    requestOperationName,
}: {
    conditionalFakes: RegisterSequenceOptions[] | undefined;
    requestVariables: Record<string, unknown> | undefined;
    logger: ReturnType<typeof createLogger>;
    sequenceId: string;
    requestOperationName: string;
}): RegisterSequenceOptions | undefined => {
    if (conditionalFakes && conditionalFakes.length > 0) {
        // Find matching fake (already sorted by specificity in descending order)
        for (const fake of conditionalFakes) {
            const context = {
                ...(requestVariables && { variables: requestVariables }),
            };

            if (evaluateCondition(fake.requestCondition, context)) {
                logger.debug("fakeGraphQLQuery: matched conditional fake", {
                    sequenceId,
                    operationName: requestOperationName,
                    requestCondition: fake.requestCondition,
                    variables: requestVariables,
                    evaluationContext: context,
                });
                return fake;
            }
            logger.debug("fakeGraphQLQuery: conditional fake did not match", {
                sequenceId,
                operationName: requestOperationName,
                requestCondition: fake.requestCondition,
                variables: requestVariables,
                evaluationContext: context,
            });
        }
    }
    return undefined;
};
