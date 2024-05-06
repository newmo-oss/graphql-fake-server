import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
    overwrite: true,
    schema: "./api/api.graphqls",
    documents: "./api/query.graphql",
    generates: {
        "./generated/": {
            preset: "client",
            presetConfig: {
                fragmentMasking: { unmaskFunctionName: "getFragmentData" },
            },
            documentTransforms: [],
        },
        "./generated/register-operation.ts": {
            plugins: ["@newmo/graphql-codegen-fake-server-client"],
            config: {
                typesFile: "./graphql.js",
            },
        },
    },
};

export default config;
