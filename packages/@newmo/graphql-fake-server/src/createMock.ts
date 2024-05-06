import vm from "node:vm";
import { generateCode, getTypeInfos, normalizeConfig } from "@newmo/graphql-fake-core";
import type { GraphQLSchema } from "graphql/index.js";
import { type LogLevel, createLogger } from "./logger.js";
export type MockObject = Record<string, unknown>;
export type GenerateMockOptions = {
    schema: GraphQLSchema;
    maxFieldRecursionDepth?: number | undefined;
    logLevel?: LogLevel | undefined;
};
const cloneAsJSON = (obj: unknown) => {
    return JSON.parse(JSON.stringify(obj));
};
/**
 * Create mock object from schema
 * It supports @example directive
 * @param options
 */
export const createMock = async (options: GenerateMockOptions): Promise<MockObject> => {
    const logger = createLogger(options.logLevel);
    try {
        const normalizedConfig = normalizeConfig({
            maxFieldRecursionDepth: options.maxFieldRecursionDepth ?? 3,
        });
        const typeInfos = getTypeInfos(normalizedConfig, options.schema);
        const code = generateCode(
            {
                ...normalizedConfig,
                outputType: "commonjs",
            },
            typeInfos,
        );
        logger.debug("Generated code:");
        logger.debug(code);
        // execute code in vm and get all exports
        const exports = {};
        vm.runInNewContext(code, { exports });
        // Apollo Server does not support Function type in mock object
        const plainObject = cloneAsJSON(exports);
        logger.debug("Exports:");
        logger.debug(JSON.stringify(plainObject, null, 2));
        return plainObject;
    } catch (error) {
        logger.error(error);
        process.exit(1);
    }
};
