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
// Validation result type for better error messages
type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string };

// Condition rules for conditional fake responses
export type ConditionRule =
    | { type: "variables"; value: Record<string, unknown> } // Match based on complete variables object
    | { type: "always" }; // Always match (default condition)

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

// Registration strategy types
export type RegistrationStrategy = "single" | "sequence" | "conditional" | "legacy";

// Single response registration
export type RegisterSingleResponse = {
    type: "single";
    operationName: string;
    data: Record<string, unknown>;
};

// Sequence response registration (array-based)
export type RegisterSequenceResponse = {
    type: "sequence";
    operationName: string;
    data: Record<string, unknown>[];
};

// Conditional response registration (supports both single and array data)
export type RegisterConditionalResponse = {
    type: "conditional";
    operationName: string;
    conditions: Array<{
        condition?: ConditionRule;
        data: Record<string, unknown> | Record<string, unknown>[];
    }>;
};

// Network error registration
export type RegisterNetworkError = {
    type: "network-error";
    operationName: string;
    responseStatusCode: number;
    errors: Record<string, unknown>[];
    requestCondition?: ConditionRule;
};

// Legacy operation response (for backward compatibility)
export type RegisterOperationResponse = {
    type: "operation";
    operationName: string;
    data: Record<string, unknown>;
    requestCondition?:
        | { type: "count"; value: number }
        | { type: "variables"; value: Record<string, unknown> };
};

export type RegisterSequenceOptions =
    | RegisterSingleResponse
    | RegisterSequenceResponse
    | RegisterConditionalResponse
    | RegisterNetworkError
    | RegisterOperationResponse;

/**
 * Check if a new registration strategy conflicts with existing strategy
 */
const checkRegistrationStrategyConflict = (
    newStrategy: RegistrationStrategy,
    existingStrategy: RegistrationStrategy | undefined,
    operationName: string,
): string | undefined => {
    if (!existingStrategy) {
        return undefined; // No conflict if no existing strategy
    }

    if (existingStrategy === newStrategy) {
        return undefined; // Same strategy is allowed (overwrite)
    }

    // Different strategies conflict
    const strategyNames = {
        single: "single response",
        sequence: "sequence response",
        conditional: "conditional response",
    };

    return (
        `Cannot register ${strategyNames[newStrategy]} for '${operationName}'. ` +
        `This operation already has a ${strategyNames[existingStrategy]} registered. ` +
        "Use the same registration method or clear existing responses first."
    );
};

/**
 * Get registration strategy from RegisterSequenceOptions
 */
const getRegistrationStrategy = (fake: RegisterSequenceOptions): RegistrationStrategy => {
    switch (fake.type) {
        case "single":
            return "single";
        case "sequence":
            return "sequence";
        case "conditional":
            return "conditional";
        case "network-error":
            return "single"; // Network errors are treated as single responses
        case "operation":
            return "legacy"; // Legacy operation responses use their own strategy
        default:
            return "single";
    }
};

/**
 * Validate condition rule structure (only variables condition is allowed)
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

    // Allow variables and always condition types
    if (condition.type !== "variables" && condition.type !== "always") {
        return {
            ok: false,
            error: `Invalid condition type '${condition.type}'. Only 'variables' and 'always' are allowed`,
        };
    }

    if (condition.type === "always") {
        // Always condition doesn't need a value
        return { ok: true, data: condition as ConditionRule };
    }

    if (!("value" in condition)) {
        return { ok: false, error: "Condition must have a 'value' field" };
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
};

const validateSequenceRegistration = (data: unknown): ValidationResult<RegisterSequenceOptions> => {
    if (typeof data !== "object" || data === null) {
        return { ok: false, error: "Request body must be an object" };
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

    // Handle network-error type
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
        return { ok: true, data: data as RegisterNetworkError };
    }

    // Handle single operation type
    if (data.type === "single") {
        if (!("data" in data) || typeof data.data !== "object" || data.data === null) {
            return {
                ok: false,
                error: "Operation type must have a 'data' field of type object",
            };
        }
        return { ok: true, data: data as RegisterSingleResponse };
    }

    // Handle sequence type
    if (data.type === "sequence") {
        if (!("data" in data) || !Array.isArray(data.data)) {
            return {
                ok: false,
                error: "Sequence type must have a 'data' field of type array",
            };
        }
        return { ok: true, data: data as RegisterSequenceResponse };
    }

    // Handle legacy operation type (for backward compatibility)
    if (data.type === "operation") {
        if (!("data" in data) || typeof data.data !== "object" || data.data === null) {
            return {
                ok: false,
                error: "Operation type must have a 'data' field of type object",
            };
        }

        // Legacy operation type can optionally have requestCondition
        const operationData = data as RegisterOperationResponse;
        const requestCondition = operationData.requestCondition;
        if (requestCondition && typeof requestCondition !== "object") {
            return {
                ok: false,
                error: "Operation type 'requestCondition' field must be an object if provided",
            };
        }

        return { ok: true, data: operationData };
    }

    // Handle conditional type
    if (data.type === "conditional") {
        if (!("conditions" in data)) {
            return {
                ok: false,
                error: "Conditional type must have a 'conditions' field",
            };
        }

        if (!Array.isArray(data.conditions)) {
            return {
                ok: false,
                error: "Conditional type 'conditions' field must be an array",
            };
        }

        if (data.conditions.length === 0) {
            return {
                ok: false,
                error: "Conditional type 'conditions' array cannot be empty",
            };
        }

        // Validate each condition in the array
        for (const conditionItem of data.conditions) {
            if (!("data" in conditionItem)) {
                return {
                    ok: false,
                    error: "Each condition must have a 'data' field",
                };
            }

            // data can be either a single object or an array
            const isValidData =
                (typeof conditionItem.data === "object" &&
                    conditionItem.data !== null &&
                    !Array.isArray(conditionItem.data)) ||
                Array.isArray(conditionItem.data);

            if (!isValidData) {
                return {
                    ok: false,
                    error: "Each condition 'data' field must be an object or array",
                };
            }

            if ("condition" in conditionItem) {
                const conditionResult = validateConditionRule(conditionItem.condition);
                if (!conditionResult.ok) {
                    return {
                        ok: false,
                        error: `Invalid condition: ${conditionResult.error}`,
                    };
                }
            }
        }

        return { ok: true, data: data as RegisterConditionalResponse };
    }

    return {
        ok: false,
        error: `Unknown request type '${data.type}'. Allowed types: 'operation', 'sequence', 'conditional', 'network-error'`,
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
}: {
    logLevel: LogLevel;
    maxRegisteredSequences: number;
    ports: {
        fakeServer: number;
        apolloServer: number;
    };
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
    const conditionalFakeResponseMap = new LRUMap<string, RegisterConditionalResponse[]>({
        maxSize: maxRegisteredSequences,
    });
    // Store sequence response arrays (array-based responses)
    const sequenceResponseArrayMap = new LRUMap<string, Record<string, unknown>[]>({
        maxSize: maxRegisteredSequences,
    });
    // Store legacy operation responses (allow multiple conditions per operation)
    const _legacyOperationResponseMap = new LRUMap<string, RegisterOperationResponse[]>({
        maxSize: maxRegisteredSequences,
    });
    // Track registration strategy for each operation
    const registrationStrategyMap = new LRUMap<string, RegistrationStrategy>({
        maxSize: maxRegisteredSequences,
    });
    // Track call count for array-based sequences
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
        });

        const baseKey = createMapKey({
            sequenceId,
            operationName,
        });

        // Get current registration strategy for this operation
        const currentStrategy = registrationStrategyMap.get(baseKey);
        const newStrategy = getRegistrationStrategy(validationResult.data);

        // Check for registration strategy conflicts
        const strategyConflict = checkRegistrationStrategyConflict(
            newStrategy,
            currentStrategy,
            operationName,
        );

        if (strategyConflict) {
            return Response.json(
                { ok: false, errors: [strategyConflict] },
                {
                    status: 400,
                },
            );
        }

        // Register based on the type
        switch (validationResult.data.type) {
            case "single":
            case "network-error":
            case "operation": {
                // Single response registration (including legacy operation type)
                sequenceFakeResponseLruMap.set(baseKey, validationResult.data);
                registrationStrategyMap.set(baseKey, "single");
                break;
            }

            case "sequence": {
                // Array-based sequence registration
                sequenceResponseArrayMap.set(baseKey, validationResult.data.data);
                registrationStrategyMap.set(baseKey, "sequence");
                break;
            }

            case "conditional": {
                // Conditional response registration
                const conditionalData = validationResult.data as RegisterConditionalResponse;
                const existingConditionalFakes = conditionalFakeResponseMap.get(baseKey) || [];

                // For new conditions array format, we need to handle each condition separately
                for (const conditionItem of conditionalData.conditions) {
                    // Check if same condition already exists (overwrite if found)
                    const existingIndex = existingConditionalFakes.findIndex((fake) => {
                        // Find matching condition in the fake's conditions array
                        return fake.conditions.some(
                            (existingCondItem) =>
                                JSON.stringify(existingCondItem.condition) ===
                                JSON.stringify(conditionItem.condition),
                        );
                    });

                    if (existingIndex >= 0) {
                        // Update existing fake with new condition
                        const existingFake = existingConditionalFakes[existingIndex];
                        if (existingFake) {
                            const conditionIndex = existingFake.conditions.findIndex(
                                (existingCondItem) =>
                                    JSON.stringify(existingCondItem.condition) ===
                                    JSON.stringify(conditionItem.condition),
                            );
                            if (conditionIndex >= 0) {
                                existingFake.conditions[conditionIndex] = conditionItem;
                            }
                        }
                    } else {
                        // Create new fake for this operation with this condition
                        const newFake: RegisterConditionalResponse = {
                            type: "conditional",
                            operationName: conditionalData.operationName,
                            conditions: [conditionItem],
                        };
                        existingConditionalFakes.push(newFake);
                    }
                }

                conditionalFakeResponseMap.set(baseKey, existingConditionalFakes);
                registrationStrategyMap.set(baseKey, "conditional");
                break;
            }

            default: {
                return Response.json(
                    { ok: false, errors: ["Unsupported registration type"] },
                    { status: 400 },
                );
            }
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

        // Increment call count for array-based sequences
        const currentCallCount = (callCountMap.get(baseKey) || 0) + 1;
        callCountMap.set(baseKey, currentCallCount);

        logger.debug("fakeGraphQLQuery: call count updated", {
            baseKey,
            currentCallCount,
            previousCount: currentCallCount - 1,
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

        // Get registration strategy to determine how to handle the request
        const registrationStrategy = registrationStrategyMap.get(baseKey);
        let matchedResponse: Record<string, unknown> | undefined;
        let responseType: "single" | "network-error" = "single";

        if (registrationStrategy === "conditional") {
            // Handle conditional responses
            const conditionalFakes = conditionalFakeResponseMap.get(baseKey);
            const matchedConditionalResult = findMatchedConditionalFake({
                conditionalFakes,
                requestVariables,
                logger,
                sequenceId,
                requestOperationName,
            });

            if (matchedConditionalResult) {
                // Find the matching condition and use its data
                const matchedCondition = matchedConditionalResult.matchedCondition;
                if (matchedCondition) {
                    // Handle both single data and array data in conditional responses
                    if (Array.isArray(matchedCondition.data)) {
                        // Array-based conditional response - use call count as index
                        const responseIndex = Math.min(
                            currentCallCount - 1,
                            matchedCondition.data.length - 1,
                        );
                        matchedResponse = matchedCondition.data[responseIndex];
                        logger.debug(
                            `fakeGraphQLQuery: conditional array response, callCount: ${currentCallCount}, responseIndex: ${responseIndex}, dataLength: ${matchedCondition.data.length}`,
                            {
                                matchedResponse,
                                allResponses: matchedCondition.data,
                            },
                        );
                    } else {
                        // Single conditional response
                        matchedResponse = matchedCondition.data;
                    }
                }
            }
        } else if (registrationStrategy === "sequence") {
            // Handle array-based sequence responses
            const sequenceArray = sequenceResponseArrayMap.get(baseKey);
            if (sequenceArray) {
                const responseIndex = Math.min(currentCallCount - 1, sequenceArray.length - 1);
                matchedResponse = sequenceArray[responseIndex];
            }
        } else if (registrationStrategy === "single") {
            // Handle single responses (including network errors and legacy operations)
            const singleResponse = sequenceFakeResponseLruMap.get(baseKey);
            if (singleResponse) {
                if (singleResponse.type === "network-error") {
                    responseType = "network-error";
                } else if (singleResponse.type === "single") {
                    matchedResponse = singleResponse.data;
                } else if (singleResponse.type === "operation") {
                    // Handle legacy operation type with optional requestCondition
                    const operationResponse = singleResponse as RegisterOperationResponse;
                    const requestCondition = operationResponse.requestCondition;

                    logger.debug("fakeGraphQLQuery: legacy operation condition check", {
                        sequenceId,
                        operationName: requestOperationName,
                        requestCondition,
                        currentCallCount,
                        requestVariables,
                    });

                    if (!requestCondition) {
                        // No condition, always match
                        logger.debug("fakeGraphQLQuery: legacy operation no condition, matching");
                        matchedResponse = operationResponse.data;
                    } else if (requestCondition.type === "count") {
                        // Match based on call count
                        const matches = currentCallCount === requestCondition.value;
                        logger.debug("fakeGraphQLQuery: legacy operation count condition", {
                            currentCallCount,
                            expectedCount: requestCondition.value,
                            matches,
                        });
                        if (matches) {
                            matchedResponse = operationResponse.data;
                        }
                    } else if (requestCondition.type === "variables") {
                        // Match based on variables
                        const matches =
                            requestVariables &&
                            JSON.stringify(requestVariables) ===
                                JSON.stringify(requestCondition.value);
                        logger.debug("fakeGraphQLQuery: legacy operation variables condition", {
                            requestVariables,
                            expectedVariables: requestCondition.value,
                            matches,
                        });
                        if (matches) {
                            matchedResponse = operationResponse.data;
                        }
                    }
                }
            }
        }

        logger.debug(
            `fakeGraphQLQuery: sequence-id: ${sequenceId} x operationName: ${requestOperationName}, strategy: ${registrationStrategy}, matched: ${Boolean(
                matchedResponse,
            )}`,
            {
                matchedResponse,
                sequenceId,
                operationName: requestOperationName,
                callCount: currentCallCount,
                strategy: registrationStrategy,
            },
        );

        if (!matchedResponse && responseType === "single") {
            logger.debug("fakeGraphQLQuery: no fake found, passing to Apollo");
            return passToApollo(c);
        }

        // Handle network error responses
        if (responseType === "network-error") {
            const singleResponse = sequenceFakeResponseLruMap.get(baseKey) as RegisterNetworkError;
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
                        status: singleResponse.responseStatusCode,
                        headers: { "Content-Type": "application/json" },
                        body: {
                            errors: singleResponse.errors,
                        },
                    },
                },
            ]);

            return new Response(
                JSON.stringify({
                    errors: singleResponse.errors,
                }),
                {
                    status: singleResponse.responseStatusCode,
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
        const data = matchedResponse;
        logger.debug(`fakeGraphQLQuery: starting data merge sequence-id: ${sequenceId}`, {
            data,
            responseBody,
        });
        // Use bracket notation for properties from index signature
        const responseData = responseBody["data"] as unknown;
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
        // Let the server automatically calculate Content-Length to avoid issues with multi-byte characters
        const responseJson = JSON.stringify({ data: merged });
        return new Response(responseJson, {
            status: proxyResponse.status,
            headers: {
                "Content-Type": "application/json",
            },
        });
    };

    // Route all other requests to the fake GraphQL query handler
    app.all("*", fakeGraphQLQuery);

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
 * Check if condition rule matches the current request context (variables only)
 */
const evaluateCondition = (
    condition: ConditionRule,
    context: {
        variables?: Record<string, unknown>;
    },
): boolean => {
    switch (condition.type) {
        case "variables":
            if (!context.variables) return false;
            return isDeepStrictEqual(context.variables, condition.value);

        case "always":
            return true; // Always matches

        default:
            return false;
    }
};

/**
 * Find a matching conditional fake based on request variables
 */
const findMatchedConditionalFake = ({
    conditionalFakes,
    requestVariables,
    logger,
    sequenceId,
    requestOperationName,
}: {
    conditionalFakes: RegisterConditionalResponse[] | undefined;
    requestVariables: Record<string, unknown> | undefined;
    logger: ReturnType<typeof createLogger>;
    sequenceId: string;
    requestOperationName: string;
}):
    | {
          fake: RegisterConditionalResponse;
          matchedCondition: {
              condition?: ConditionRule;
              data: Record<string, unknown> | Record<string, unknown>[];
          };
      }
    | undefined => {
    if (!conditionalFakes || conditionalFakes.length === 0) {
        return undefined;
    }

    // Find matching fake based on variables condition
    for (const fake of conditionalFakes) {
        const context = {
            ...(requestVariables && { variables: requestVariables }),
        };

        // Check each condition in the conditions array
        for (const conditionItem of fake.conditions) {
            // If no condition is specified, it's a default condition (always matches)
            if (!conditionItem.condition || evaluateCondition(conditionItem.condition, context)) {
                logger.debug("fakeGraphQLQuery: matched conditional fake", {
                    sequenceId,
                    operationName: requestOperationName,
                    condition: conditionItem.condition,
                    variables: requestVariables,
                });
                return { fake, matchedCondition: conditionItem };
            }
        }
    }

    return undefined;
};
