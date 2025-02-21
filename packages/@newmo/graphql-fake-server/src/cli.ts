#!/usr/bin/env node
import { parseArgs } from "node:util";
import {
    loadConfig,
    loadFakeServerConfigFromCLI,
    normalizeFakeServerConfig,
    validateFakeServerConfig,
} from "./config.js";
import { createFakeServer } from "./index.js";
import { type LogLevel, createLogger } from "./logger.js";

const HELP = `
Usage: npx @newmo/graphql-fake-server --schema <path> [options]

Options:

    --config <path>       Path to a config file
    --schema <path>       Path to a schema file
    --logLevel <logLevel> log level: debug, info, warn, error
    --cwd <path>          Current working directory
    --help                Show help

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
        cwd: {
            type: "string",
            description: "Current working directory",
            default: process.cwd(),
        },
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
        help: {
            type: "boolean",
            description: "Show help",
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
    if (values.help) {
        return {
            stdout: HELP,
            stderr: "",
            exitCode: 0,
        };
    }
    const logLevel = values.logLevel as LogLevel | undefined;
    if (!logLevel || !["debug", "info", "warn", "error"].includes(logLevel)) {
        return {
            stdout: "",
            stderr: "--logLevel must be one of debug, info, warn, error",
            exitCode: 1,
        };
    }
    const schemaFilePath = values.schema;
    // prefer config file over CLI options
    const config = values.config
        ? await loadConfig(values.cwd ?? process.cwd(), values.config)
        : loadFakeServerConfigFromCLI({
              schemaFilePath,
              logLevel,
          });
    const logger = createLogger(config.logLevel ?? logLevel);
    logger.debug("[fake-server-cli] config", config);
    try {
        const server = await createFakeServer(config);
        const { urls } = await server.start();
        logger.info(`🚀 GraphQL Fake Server listening at: ${urls.fakeServer}`);
        logger.info(`🎨 GraphQL Playground is available at ${urls.apolloServer}`);
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
