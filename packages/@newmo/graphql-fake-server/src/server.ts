import fs from "node:fs/promises";
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { addMocksToSchema } from "@graphql-tools/mock";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { serve } from "@hono/node-server";
import { type MockObject, createMock } from "@newmo/graphql-fake-core";
//@ts-expect-error
import depthLimit from "graphql-depth-limit";
import type { GraphQLSchema } from "graphql/index.js";
import { buildSchema } from "graphql/utilities/index.js";
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { type LogLevel, createLogger } from "./logger.js";

export type CreateFakeServerOptions = {
    schemaFilePath: string;
    ports?: {
        fakeServer: number;
        apolloServer: number;
    };
    /**
     * max query depth for complexity of query
     * Default is 3
     */
    maxQueryDepth?: number;
    /**
     * maxFieldRecursionDepth for creating fake data
     * Default is maxDepth + 1
     */
    maxFieldRecursionDepth?: number;
    /**
     * max number of registered sequences
     * Default is 1000
     * If the number of registered sequences exceeds this number, the oldest sequence is deleted.
     */
    maxRegisteredSequences?: number;
    logLevel?: LogLevel;
};

type FakeServerInternal = {
    schema: GraphQLSchema;
    mockObject: MockObject;
    ports: {
        fakeServer: number;
        apolloServer: number;
    };
    maxQueryDepth: number;
    maxFieldRecursionDepth: number;
    maxRegisteredSequences: number;
    logLevel: LogLevel;
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
export type RegisterSequenceNetworkError = {
    type: "network-error";
    operationName: string;
    responseStatusCode: number;
    errors: Record<string, unknown>[];
};
export type RegisterSequenceOperation = {
    type: "operation";
    operationName: string;
    data: Record<string, unknown>;
};
export type RegisterSequenceOptions = RegisterSequenceNetworkError | RegisterSequenceOperation;
export type RegisterOperationResponse =
    | {
          ok: true;
      }
    | {
          ok: false;
          errors: string[];
      };
const validateSequenceRegistration = (data: unknown): data is RegisterSequenceOptions => {
    if (typeof data !== "object" || data === null) return false;
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
    // pass through to apollo server
    const passToApollo = async (c: Context) => {
        // remove prefix
        // prefix = /app1/*, path = /app1/a/b
        // => suffix_path = /a/b
        // let path = new URL(c.req.raw.url).pathname
        let path = c.req.path;
        logger.debug("pass to apollo server", {
            path,
        });
        path = path.replace(new RegExp(`^${c.req.routePath.replace("*", "")}`), "/");
        let url = `http://127.0.0.1:${ports.apolloServer}${path}`;
        // add params to URL
        if (c.req.query()) url = `${url}?${new URLSearchParams(c.req.query())}`;
        // request
        const rep = await fetch(url, {
            method: c.req.method,
            headers: c.req.raw.headers,
            body: c.req.raw.body,
            duplex: "half",
        });
        // log response with pipe
        if (rep.status === 101) return rep;
        return new Response(rep.body, rep);
    };
    const sequenceLruMap = new LRUMap<string, RegisterSequenceOptions>({
        maxSize: maxRegisteredSequences,
    });
    const app = new Hono();
    // /fake api does not support CORS
    // because it allows any user to modify the response
    // If you need to support CORS, implement with checking the origin or something
    app.post("/fake", async (c) => {
        logger.debug("/fake");
        const sequenceId = c.req.header("sequence-id");
        if (!sequenceId) {
            return Response.json(
                JSON.stringify({ ok: false, errors: ["sequence-id is required"] }),
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
        logger.debug("/fake got body type", {
            sequenceId,
            type: body.type,
        });
        sequenceLruMap.set(sequenceId, body);
        return Response.json(JSON.stringify({ ok: true }), {
            status: 200,
        });
    });
    const fakeGraphQLQuery = async (c: Context) => {
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
        // 2. Does it contain a sequence id?
        if (!sequenceId) return passToApollo(c);
        const sequence = sequenceLruMap.get(sequenceId);
        logger.debug(`/query: sequence-id: ${sequenceId}, sequence exists: ${Boolean(sequence)}`, {
            sequence,
            sequenceId,
        });
        if (!sequence) return passToApollo(c);

        const requestBody = await c.req.raw.clone().json();
        const requestOperationName =
            typeof requestBody === "object" &&
            requestBody !== null &&
            "operationName" in requestBody &&
            requestBody.operationName;
        logger.debug(`operationName: ${requestOperationName} sequenceId: ${sequenceId}`, {
            sequenceId,
        });
        if (requestOperationName !== sequence.operationName) {
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
        if (sequence.type === "network-error") {
            return new Response(JSON.stringify(sequence.errors), {
                status: sequence.responseStatusCode,
            });
        }
        // 3. Send a request to Apollo Server
        logger.debug("request to apollo-server", {
            sequenceId,
        });
        const rep = await fetch(`http://127.0.0.1:${ports.apolloServer}/graphql`, {
            method: c.req.method,
            headers: c.req.raw.headers,
            body: c.req.raw.body,
            duplex: "half",
        });
        logger.debug("/query: response from apollo-server", {
            sequenceId,
            rep,
        });
        if (rep.status === 101) return rep;
        // 4. Does the request contain a sequence id?
        const responseBody = await rep.json();
        // 5. Merge the registration data with the response from 2
        const data = sequence.data;
        logger.debug(`/query: merge sequence-id: ${sequenceId}`, {
            data,
            responseBody,
        });
        const merged = {
            //@ts-expect-error
            ...responseBody.data,
            ...data,
        };
        return Response.json(
            {
                data: merged,
            },
            rep,
        );
    };
    app.use("/graphql", cors());
    app.use("/query", cors());
    app.use("/graphql", fakeGraphQLQuery);
    app.use("/query", fakeGraphQLQuery);
    app.all("*", passToApollo);
    return app;
};
export const createFakeServer = async (options: CreateFakeServerOptions) => {
    const logger = createLogger(options.logLevel);
    const schema = buildSchema(await fs.readFile(options.schemaFilePath, "utf-8"));
    const mockResult = await createMock({
        schema,
        maxFieldRecursionDepth: options.maxFieldRecursionDepth,
    });
    if (!mockResult.ok) {
        logger.error("Failed to create mock data", mockResult);
        throw new Error("Failed to create mock data", {
            cause: mockResult.error,
        });
    }
    logger.debug("created mock code", mockResult.code);
    logger.debug("created mock data", mockResult.mock);
    const ports = {
        fakeServer: options.ports?.fakeServer ?? 4000,
        apolloServer: options.ports?.apolloServer ?? 4001,
    };
    const maxQueryDepth = options.maxQueryDepth ?? 3;
    const maxFieldRecursionDepth = options.maxFieldRecursionDepth ?? maxQueryDepth + 1;
    const maxRegisteredSequences = options.maxRegisteredSequences ?? 1000;
    return createFakeServerInternal({
        ports,
        schema,
        mockObject: mockResult.mock,
        maxQueryDepth,
        maxFieldRecursionDepth,
        maxRegisteredSequences,
        logLevel: options.logLevel ?? "info",
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
            const { url } = await startStandaloneServer(apolloServer, {
                listen: { port: options.ports.apolloServer },
            });
            routerServer = serve({
                fetch: routingServer.fetch,
                port: options.ports.fakeServer,
            });
            return {
                urls: {
                    fakeServer: `http://127.0.0.1:${options.ports.fakeServer}`,
                    apolloServer: `http://127.0.0.1:${options.ports.apolloServer}`,
                },
            };
        },
        stop: () => {
            apolloServer.stop();
            routerServer?.close();
        },
    };
};
