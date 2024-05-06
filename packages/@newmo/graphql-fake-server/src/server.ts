import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { addMocksToSchema } from "@graphql-tools/mock";
import { makeExecutableSchema } from "@graphql-tools/schema";
//@ts-expect-error
import depthLimit from "graphql-depth-limit";
import type { LogLevel } from "./logger.js";
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
const createRoutingServer = async ({
    apollo,
    ports,
}: {
    apollo: ApolloServer;
    ports: {
        fakeServer: number;
        apolloServer: number;
    };
}) => {
    const app = new Hono();
    // app.post("/register-operation", async (req, res) => {});
    app.use("/graphql", async (c) => {
        return passToApollo(c);
    });
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
        if (rep.status === 101) return rep;
        return new Response(rep.body, rep);
    };
    app.all("/*", passToApollo);
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
    return createFakeServerInternal({
        ports,
        schema,
        mockObject,
        maxDepth,
        maxFieldRecursionDepth,
        logLevel: options.logLevel ?? "info",
    });
};

export const createFakeServerInternal = async (options: FakeServerInternal) => {
    const apolloServer = await creteApolloServer(options);
    const routingServer = await createRoutingServer({
        apollo: apolloServer,
        ports: options.ports,
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
