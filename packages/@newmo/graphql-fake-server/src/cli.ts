#!/usr/bin/env node
import * as fs from "node:fs/promises";
import { parseArgs } from "node:util";
import { buildSchema } from "graphql/utilities/index.js";
import { createMock, startFakeServer } from "./index.js";
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
        // --port
        port: {
            type: "string",
            description: "Port to run the server on",
            default: "4000",
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
}: typeof cli = cli): Promise<
    | {
          stdout: string;
          stderr: string | Error;
          exitCode: number;
      }
    | (() => void)
> => {
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
    const port = values.port ? Number.parseInt(values.port, 10) : Number.NaN;
    if (Number.isNaN(port)) {
        logger.info(HELP);
        return {
            stdout: "",
            stderr: "--port must be a number",
            exitCode: 1,
        };
    }
    try {
        const schema = buildSchema(await fs.readFile(schemaPath, "utf-8"));
        const mockObject = await createMock({
            schema,
            logLevel: logLevel,
        });
        const closeServer = await startFakeServer({
            mockObject,
            port,
            schema,
        });
        // TODO: more readable output?
        return closeServer;
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
