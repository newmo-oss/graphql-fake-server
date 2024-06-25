#!/usr/bin/env node
import { parseArgs } from "node:util";
import { loadConfig, normalizeFakeServerConfig } from "./config.js";
import { createFakeServer } from "./index.js";
import { type LogLevel, createLogger } from "./logger.js";

const HELP = `
Usage: npx @newmo/graphql-fake-server --schema <path> [options]

Options:

    --schema <path>       Path to a schema file
    --config <path>       Path to a config file
    --logLevel <logLevel> log level: debug, info, warn, error

Examples:

    # Provide a schema file - use default config
    npx @newmo/graphql-fake-server --schema api.graphql
    # Use a config file
    npx @newmo/graphql-fake-server --config graphql-fake-server.config.js

`;
// cli foo.graphql
export const cli = parseArgs({
    args: process.argv.slice(2),
    options: {
        schema: {
            type: "string",
            description: "Path to a schema file",
        },
        config: {
            type: "string",
            description: "Path to a config file",
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
    const schemaFilePath = values.schema;
    if (!schemaFilePath) {
        logger.info(HELP);
        return {
            stdout: "",
            stderr: "--schema is required",
            exitCode: 1,
        };
    }

    const config = values.config
        ? await loadConfig(values.config)
        : normalizeFakeServerConfig({
              schemaFilePath,
              logLevel,
          });
    try {
        const server = await createFakeServer(config);
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
