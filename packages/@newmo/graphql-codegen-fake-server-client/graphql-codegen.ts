import type { CodegenConfig } from "@graphql-codegen/cli";

const plugin = require.resolve("./dist/graphql-codegen-fake-server-operation.js");
const config: CodegenConfig = {
    overwrite: true,
    schema: "./test/api/graphql/api.graphqls",
    documents: "./test/api/graphql/query.graphql",
    generates: {
        "./test/snapshots/typescript/": {
            preset: "client",
            presetConfig: {
                fragmentMasking: { unmaskFunctionName: "getFragmentData" },
            },
            documentTransforms: [],
        },
        "./test/snapshots/typescript/register-operation.ts": {
            plugins: ["@newmo/graphql-codegen-fake-server-operation"],
            config: {
                typesFile: "./graphql", // required
            },
        },
    },
};

export default config;
