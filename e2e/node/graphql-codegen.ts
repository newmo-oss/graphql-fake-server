import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
    overwrite: true,
    schema: "./api/api.graphqls",
    documents: "./api/**/*.graphql",
    generates: {
        "./generated/": {
            preset: "client",
            presetConfig: {
                fragmentMasking: { unmaskFunctionName: "getFragmentData" },
            },
            config: {
                namingConvention: {
                    enumValues: "change-case-all#upperCase",
                },
                nonOptionalTypename: true,
                useTypeImports: true,
                avoidOptionals: true,
                enumsAsConst: true,
                strictScalars: true,
                defaultScalarType: "unknown",
                scalars: {
                    DATE_YYYYMMDD: "string",
                    DATE_YYYYMM: "string",
                },
            },
            documentTransforms: [],
        },
        "./generated/fake.ts": {
            plugins: ["@newmo/graphql-codegen-fake-server-client"],
            config: {
                typesFile: "./graphql.js",
            },
        },
    },
};

export default config;
