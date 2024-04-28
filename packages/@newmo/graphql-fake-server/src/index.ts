import { GraphQLSchema } from "graphql/index.js";
import { ApolloServer } from "@apollo/server";
import { addMocksToSchema } from "@graphql-tools/mock";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { startStandaloneServer } from "@apollo/server/standalone";
import { generateCode, getTypeInfos, normalizeConfig } from "@newmo/graphql-fake-core";
import vm from "node:vm";
import { createLogger, LogLevel } from "./logger.js";
//@ts-expect-error
import depthLimit from "graphql-depth-limit";

export type MockObject = Record<string, any>;
export type StartFakeServerOptions = {
    schema: GraphQLSchema;
    mockObject: MockObject;
    port?: number;
    logLevel?: LogLevel;
}
export const startFakeServer = async ({
                                          schema,
                                          mockObject,
                                          port,
                                          logLevel
                                      }: StartFakeServerOptions) => {
    const logger = createLogger(logLevel);
    const mocks = Object.fromEntries(Object.entries(mockObject).map(([key, value]) => {
            return [key, () => value];
        })
    )
    const server = new ApolloServer({
        schema: addMocksToSchema({
            schema: makeExecutableSchema({
                typeDefs: schema
            }),
            mocks,
        }),
        validationRules: [depthLimit(1)]
    });
    const { url } = await startStandaloneServer(server, { listen: { port: port } });
    logger.info(`🚀 Server listening at: ${url}`);
    return () => {
        // close
        server.stop();
    }
}
export type GenerateMockOptions = {
    schema: GraphQLSchema
    logLevel?: LogLevel;
}
/**
 * Create mock object from schema
 * It supports @example directive
 * @param options
 */
export const createMock = async (options: GenerateMockOptions): Promise<MockObject> => {
    const logger = createLogger(options.logLevel);
    try {
        const normalizedConfig = normalizeConfig({
            maxFieldRecursionDepth: 2
        });
        const typeInfos = getTypeInfos(normalizedConfig, options.schema);
        const code = generateCode({
            ...normalizedConfig,
            outputType: "commonjs"
        }, typeInfos);
        logger.debug("Generated code:");
        logger.debug(code);
        // execute code in vm and get all exports
        const exports = {};
        vm.runInNewContext(code, { exports });
        logger.debug("Exports:");
        logger.debug(exports);
        return exports;
    } catch (error) {
        logger.error(error);
        process.exit(1);
    }

}
