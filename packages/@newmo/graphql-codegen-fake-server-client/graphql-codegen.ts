import type { CodegenConfig } from "@graphql-codegen/cli";

const plugin = "./dist/graphql-codegen-fake-server-client.js";
const config: CodegenConfig = {
    overwrite: true,
    emitLegacyCommonJSImports: false,
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
        "./test/snapshots/typescript/fake-client.ts": {
            plugins: [plugin],
            config: {
                typesFile: "./graphql.js", // required
            },
        },
    },
};

export default config;
