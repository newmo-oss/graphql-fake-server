/**
 * @type {import("@newmo/graphql-fake-server").FakeServerConfig}
 */
const config = {
    logLevel: "debug",
    schemaFilePath: "api/api.graphqls",
    server: {
        maxQueryDepth: 10,
    },
    // Define the default value of the custom scalar.
    mock: {
        defaultValues: {
            CustomScalar: {
                DATE_YYYYMMDD: "'2022-02-03'",
            },
        },
    },
};
export default config;
