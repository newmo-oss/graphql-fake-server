import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { addMocksToSchema } from "@graphql-tools/mock";
import { makeExecutableSchema } from "@graphql-tools/schema";
//@ts-expect-error
import depthLimit from "graphql-depth-limit";
import { createLogger, type LogLevel } from "./logger.js";
import fs from "node:fs/promises";
import { buildSchema } from "graphql/utilities/index.js";
import { createMock } from "./createMock.js";

export type CreateFakeServerOptions = {
    schemaFilePath: string;
    port?: number;
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
export const createFakeServer = async (options: CreateFakeServerOptions) => {
    const schema = buildSchema(await fs.readFile(options.schemaFilePath, "utf-8"));
    const mockObject = await createMock({
        schema,
        logLevel: options.logLevel,
        maxFieldRecursionDepth: options.maxFieldRecursionDepth,
    });
    const logger = createLogger(options.logLevel);
    const mocks = Object.fromEntries(
        Object.entries(mockObject).map(([key, value]) => {
            return [key, () => value];
        }),
    );
    const server = new ApolloServer({
        schema: addMocksToSchema({
            schema: makeExecutableSchema({
                typeDefs: schema,
            }),
            mocks,
        }),
        validationRules: [depthLimit(3)],
    });
    return {
        start: async () => {
            const { url } = await startStandaloneServer(server, { listen: { port: options.port } });
            return {
                url,
            };
        },
        stop: () => {
            server.stop();
        },
    };
};
