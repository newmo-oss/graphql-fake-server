#!/usr/bin/env node
import fs from "node:fs/promises";
import { parseArgs } from "node:util";
import vm from "node:vm";
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { addMocksToSchema } from '@graphql-tools/mock';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { buildSchema } from "graphql";
import { GraphQLSchema } from "graphql/index.js";
import { generateCode } from "./code-generator.js";
import { normalizeConfig } from "./config.js";
import { getTypeInfos } from "./schema-scanner.js";

const HELP = `
Usage: cli <file.graphql>
`;
// cli foo.graphql
const { positionals, values } = parseArgs({
    args: process.argv.slice(2), allowPositionals: true,
    options: {
        // --port
        port: {
            type: "string",
            description: "Port to run the server on",
            default: "4000",
        },
        verbose: {
            type: "boolean",
            description: "Verbose output",
            default: false
        }
    }
});
if (!positionals.length) {
    console.info(HELP);
    process.exit(1);
}
const [filePath] = positionals;
if (!filePath) {
    console.error(HELP);
    process.exit(1);
}
const port = values.port ? Number.parseInt(values.port, 10) : NaN;
if (Number.isNaN(port)) {
    console.error("--port must be a number");
    process.exit(1);
}
const startFakeServer = async ({
                                   schema,
                                   mockObject
                               }: {
    schema: GraphQLSchema;
    mockObject: Record<string, {}>
}) => {

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
    });

    const { url } = await startStandaloneServer(server, { listen: { port: port } });

    console.log(`🚀 Server listening at: ${url}`);
}
try {
    const schema = buildSchema(await fs.readFile(filePath, "utf-8"));
    const normalizedConfig = normalizeConfig({
        typesFile: "types.ts",
    });
    const typeInfos = getTypeInfos(normalizedConfig, schema);
    const code = generateCode(normalizedConfig, typeInfos);
    if (values.verbose) {
        console.info("Generated code:");
        console.info(code);
    }
    // execute code in vm and get all exports
    const exports = {};
    vm.runInNewContext(code, { exports });
    if (values.verbose) {
        console.info("Exports:");
        console.info(exports);
    }
    await startFakeServer({
        schema,
        mockObject: exports
    });
    // write to file
} catch (error) {
    console.error(error);
    process.exit(1);
}
