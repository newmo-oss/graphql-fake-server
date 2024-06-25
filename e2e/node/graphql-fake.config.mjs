/**
 * @type {import("@newmo/graphql-fake-server").FakeServerConfig}
 */
const config = {
    logLevel: "debug",
    schemaFilePath: "api/api.graphqls",
    // Define the default value of the custom scalar.
    defaultValues: {
        CustomScalar: {
            DATE_YYYYMMDD: "'2022-02-03'",
        },
    },
};
export default config;
