import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { addMocksToSchema } from "@graphql-tools/mock";
import { makeExecutableSchema } from "@graphql-tools/schema";
//@ts-expect-error
import depthLimit from "graphql-depth-limit";
import { createLogger, LogLevel } from "./logger.js";
import fs from "node:fs/promises";
import { buildSchema } from "graphql/utilities/index.js";
import { createMock, type MockObject } from "./createMock.js";
import { type Context, Hono } from "hono";
import { serve } from "@hono/node-server";
import type { GraphQLSchema } from "graphql/index.js";

export type CreateFakeServerOptions = {
    schemaFilePath: string;
    ports?: {
        fakeServer: number;
        apolloServer: number;
    };
    /**
     * maxDepth for depthLimit
     * Default is 3
     */
    maxDepth?: number;
    /**
     * maxFieldRecursionDepth for Mocking
     * Default is maxDepth + 1
     */
    maxFieldRecursionDepth?: number;
    /**
     * max number of registered sequences
     * Default is 100
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
    maxDepth: number;
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
    const server = new ApolloServer({
        schema: addMocksToSchema({
            schema: makeExecutableSchema({
                typeDefs: options.schema,
            }),
            mocks,
        }),
        validationRules: [depthLimit(options.maxDepth)],
    });
    return server;
};
type SequenceRegistration =
    | {
          type: "network-error";
          statusCode: number;
          errors: Record<string, unknown>[];
      }
    | {
          type: "operation";
          data: Record<string, unknown>;
      };
// TODO: more strict validation?
const validateSequenceRegistration = (data: unknown): data is SequenceRegistration => {
    if (typeof data !== "object" || data === null) return false;
    if ("type" in data && typeof data.type === "string") {
        if (data.type === "network-error") {
            return (
                "errors" in data &&
                Array.isArray(data.errors) &&
                "statusCode" in data &&
                typeof data.statusCode === "number"
            );
        }
        if (data.type === "operation") {
            return "data" in data && typeof data.data === "object";
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
        path = path.replace(new RegExp(`^${c.req.routePath.replace("*", "")}`), "/");
        let url = `http://localhost:${ports.apolloServer}${path}`;
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
    const sequenceLruMap = new LRUMap<string, SequenceRegistration>({
        maxSize: maxRegisteredSequences,
    });
    const app = new Hono();
    app.post("/register-operation", async (c) => {
        const sequenceId = c.req.header("sequence-id");
        if (!sequenceId) {
            c.status(400);
            c.body("sequence-id is required");
            return;
        }
        const body = await c.req.json();
        if (!validateSequenceRegistration(body)) {
            c.status(400);
            c.body("invalid body");
            return;
        }
        logger.debug(`register-operation: ${sequenceId}`, {
            type: body.type,
        });
        sequenceLruMap.set(sequenceId, body);
        c.status(200);
        c.body({
            ok: true,
            sequenceId,
        });
    });
    app.use("/graphql", async (c) => {
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
        logger.debug(`request sequence-id: ${sequenceId}`, {
            sequence,
        });
        if (!sequence) return passToApollo(c);
        if (sequence.type === "network-error") {
            return new Response(JSON.stringify(sequence.errors), {
                status: sequence.statusCode,
            });
        }
        // 3. Send a request to Apollo Server
        logger.debug(`request to apollo-server: ${sequenceId}`);
        const rep = await fetch(`http://localhost:${ports.apolloServer}/graphql`, {
            method: c.req.method,
            headers: c.req.raw.headers,
            body: c.req.raw.body,
            duplex: "half",
        });
        if (rep.status === 101) return rep;
        // 4. Does the request contain a sequence id?
        const responseBody = await rep.json();
        // 5. Merge the registration data with the response from 2
        const data = sequence.data;
        logger.debug(`merge sequence-id: ${sequenceId}`, {
            data,
            responseBody,
        });
        const merged = {
            //@ts-expect-error
            ...responseBody.data,
            ...data,
        };
        return Response.json(merged, rep);
    });

    return app;
};
export const createFakeServer = async (options: CreateFakeServerOptions) => {
    const schema = buildSchema(await fs.readFile(options.schemaFilePath, "utf-8"));
    const mockObject = await createMock({
        schema,
        logLevel: options.logLevel,
        maxFieldRecursionDepth: options.maxFieldRecursionDepth,
    });
    const ports = {
        fakeServer: options.ports?.fakeServer ?? 4000,
        apolloServer: options.ports?.apolloServer ?? 4001,
    };
    const maxDepth = options.maxDepth ?? 3;
    const maxFieldRecursionDepth = options.maxFieldRecursionDepth ?? maxDepth + 1;
    const maxRegisteredSequences = options.maxRegisteredSequences ?? 100;
    return createFakeServerInternal({
        ports,
        schema,
        mockObject,
        maxDepth,
        maxFieldRecursionDepth,
        maxRegisteredSequences,
        logLevel: options.logLevel ?? "info",
    });
};

export const createFakeServerInternal = async (options: FakeServerInternal) => {
    const apolloServer = await creteApolloServer(options);
    const routingServer = await createRoutingServer({
        apollo: apolloServer,
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
                url,
            };
        },
        stop: () => {
            apolloServer.stop();
            routerServer?.close();
        },
    };
};
