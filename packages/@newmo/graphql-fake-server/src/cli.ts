#!/usr/bin/env node
import * as fs from "node:fs";
import { parseArgs } from "node:util";
import { generateMock, startFakeServer } from "./index.js";
import { buildSchema } from "graphql/utilities/index.js";
import { createLogger, LogLevel } from "./logger.js";

const HELP = `
Usage: npx @newmo/graphql-fake-server --schema <path> [options]

Options:

    --schema <path>   Path to the schema file. e.g. schema.graphql
    --port <port>     Port to run the server on
    --logLevel <logLevel> log level: debug, info, warn, error

`;
// cli foo.graphql
const { values } = parseArgs({
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
            default: "info"
        }
    }
});
const schemaPath = values.schema;
if (!schemaPath) {
    console.error("--schema is required");
    process.exit(1);
}
const port = values.port ? Number.parseInt(values.port, 10) : NaN;
if (Number.isNaN(port)) {
    console.error("--port must be a number");
    process.exit(1);
}
const logLevel = values.logLevel as LogLevel | undefined;
if (!logLevel || !["debug", "info", "warn", "error"].includes(logLevel)) {
    console.error("--logLevel must be one of debug, info, warn, error");
    process.exit(1);
}
const logger = createLogger(logLevel);
try {

    const schema = buildSchema(await fs.readFileSync(schemaPath, "utf-8"));
    const mockObject = await generateMock({
        schema,
        logLevel: logLevel
    });
    await startFakeServer({
        mockObject,
        port,
        schema
    });
} catch (error) {
    logger.info("Failed to start server");
    logger.error(error);
    process.exit(1);
}
