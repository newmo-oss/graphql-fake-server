#!/usr/bin/env node
import { parseArgs } from "node:util";
import { createFakeServer } from "./index.js";
import { type LogLevel, createLogger } from "./logger.js";

const HELP = `
Usage: npx @newmo/graphql-fake-server --schema <path> [options]

Options:

    --schema <path>   Path to the schema file. e.g. schema.graphql
    --port <port>     Port to run the server on
    --logLevel <logLevel> log level: debug, info, warn, error

`;
// cli foo.graphql
export const cli = parseArgs({
    args: process.argv.slice(2),
    options: {
        // --schema
        schema: {
            type: "string",
            description: "Path to the schema file. e.g. schema.graphql",
        },
        mainPort: {
            type: "string",
            description: "Port to run the server on",
            default: "4000",
        },
        apolloPort: {
            type: "string",
            description: "Port to run the server on",
            default: "4002",
        },
        maxRegisteredSequences: {
            type: "string",
            description: "Max number of registered sequences.",
            default: "1000",
        },
        maxQueryDepth: {
            type: "string",
            description: "max query depth for complexity of query",
            default: "3",
        },
        maxFieldRecursionDepth: {
            type: "string",
            description: "maxFieldRecursionDepth for creating fake data",
            default: "4",
        },
        logLevel: {
            type: "string",
            description: "log level: debug, info, warn, error",
            default: "info",
        },
    },
});
export const run = async ({
    values,
}: typeof cli = cli): Promise<{
    stdout: string;
    stderr: string | Error;
    exitCode: number;
    doNotExit?: boolean;
}> => {
    const logLevel = values.logLevel as LogLevel | undefined;
    if (!logLevel || !["debug", "info", "warn", "error"].includes(logLevel)) {
        return {
            stdout: "",
            stderr: "--logLevel must be one of debug, info, warn, error",
            exitCode: 1,
        };
    }
    const logger = createLogger(logLevel);
    const schemaPath = values.schema;
    if (!schemaPath) {
        logger.info(HELP);
        return {
            stdout: "",
            stderr: "--schema is required",
            exitCode: 1,
        };
    }
    const mainPort = values.mainPort ? Number.parseInt(values.mainPort, 10) : Number.NaN;
    const apolloPort = values.apolloPort ? Number.parseInt(values.apolloPort, 10) : Number.NaN;
    if (Number.isNaN(mainPort) || Number.isNaN(apolloPort)) {
        logger.info(HELP);
        return {
            stdout: "",
            stderr: "port must be a number",
            exitCode: 1,
        };
    }
    const maxFieldRecursionDepth = values.maxFieldRecursionDepth
        ? Number.parseInt(values.maxFieldRecursionDepth, 10)
        : Number.NaN;
    if (Number.isNaN(maxFieldRecursionDepth)) {
        logger.info(HELP);
        return {
            stdout: "",
            stderr: "maxFieldRecursionDepth must be a number",
            exitCode: 1,
        };
    }
    const maxQueryDepth = values.maxQueryDepth
        ? Number.parseInt(values.maxQueryDepth, 10)
        : Number.NaN;
    if (Number.isNaN(maxQueryDepth)) {
        logger.info(HELP);
        return {
            stdout: "",
            stderr: "maxQueryDepth must be a number",
            exitCode: 1,
        };
    }
    const maxRegisteredSequences = values.maxRegisteredSequences
        ? Number.parseInt(values.maxRegisteredSequences, 10)
        : Number.NaN;
    if (Number.isNaN(maxRegisteredSequences)) {
        logger.info(HELP);
        return {
            stdout: "",
            stderr: "maxRegisteredSequences must be a number",
            exitCode: 1,
        };
    }
    try {
        const server = await createFakeServer({
            schemaFilePath: schemaPath,
            maxRegisteredSequences,
            maxFieldRecursionDepth,
            maxQueryDepth,
            logLevel,
            ports: {
                fakeServer: mainPort,
                apolloServer: apolloPort,
            },
        });
        const { urls } = await server.start();
        logger.info(`🚀 GraphQL Fake Server listening at: ${urls.fakeServer}`);
        return {
            stdout: "",
            stderr: "",
            exitCode: 0,
            doNotExit: true,
        };
    } catch (error) {
        logger.error(error);
        return {
            stdout: "",
            stderr: new Error("Failed to start server", {
                cause: error,
            }),
            exitCode: 1,
        };
    }
};
