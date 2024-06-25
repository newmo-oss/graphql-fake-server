import type { RawConfig } from "@newmo/graphql-fake-core";

/**
 * Configuration for the fake server.
 */
export type FakeServerConfig = {
    /**
     * The path to the GraphQL schema file.
     */
    schemaFilePath: string;
    ports?:
        | {
              /**
               * Fake Server port.
               * Default is 4000.
               */
              fakeServer?: number | undefined;
              /**
               * Apollo Server port.
               * It provides the GraphQL Playground.
               * Default is 4002.
               */
              apolloServer?: number | undefined;
          }
        | undefined;
    /**
     * The maximum number of registered sequences.
     * Default is 1000.
     */
    maxRegisteredSequences?: number | undefined;
    /**
     * The maximum number of depth of field recursion.
     * Default is 3.
     */
    maxFieldRecursionDepth?: RawConfig["maxFieldRecursionDepth"] | undefined;
    /**
     * The maximum number of depth of complexity of query
     * Default is 4
     */
    maxQueryDepth?: number | undefined;
    /**
     * Default values for scalar types.
     */
    defaultValues?: RawConfig["defaultValues"] | undefined;
};
export type RequiredFakeServerConfig = {
    schemaFilePath: string;
    ports: {
        fakeServer: number;
        apolloServer: number;
    };
    maxRegisteredSequences: number;
    maxFieldRecursionDepth: number;
    maxQueryDepth: number;
    defaultValues: RawConfig["defaultValues"];
};
export const normalizeFakeServerConfig = (config: FakeServerConfig): RequiredFakeServerConfig => {
    return {
        schemaFilePath: config.schemaFilePath,
        ports: {
            fakeServer: config.ports?.fakeServer ?? 4000,
            apolloServer: config.ports?.apolloServer ?? 4002,
        },
        maxRegisteredSequences: config.maxRegisteredSequences ?? 1000,
        maxFieldRecursionDepth: config.maxFieldRecursionDepth ?? 3,
        maxQueryDepth: config.maxQueryDepth ?? 4,
        defaultValues: config.defaultValues ?? {},
    };
};
export const validateFakeServerConfig = (config: FakeServerConfig): void => {
    if (!config.schemaFilePath) {
        throw new Error("The schemaFilePath is required.");
    }
    if (typeof config.schemaFilePath !== "string") {
        throw new Error("The schemaPath must be a string.");
    }
    if (config.ports) {
        if (typeof config.ports !== "object") {
            throw new Error("The ports must be an object.");
        }
        if (config.ports.fakeServer && typeof config.ports.fakeServer !== "number") {
            throw new Error("The fakeServer port must be a number.");
        }
        if (config.ports.apolloServer && typeof config.ports.apolloServer !== "number") {
            throw new Error("The apolloServer port must be a number.");
        }
    }
    if (config.maxRegisteredSequences && typeof config.maxRegisteredSequences !== "number") {
        throw new Error("The maxRegisteredSequences must be a number.");
    }
    if (config.maxFieldRecursionDepth && typeof config.maxFieldRecursionDepth !== "number") {
        throw new Error("The maxFieldRecursionDepth must be a number.");
    }
    if (config.maxQueryDepth && typeof config.maxQueryDepth !== "number") {
        throw new Error("The maxQueryDepth must be a number.");
    }
    if (config.defaultValues) {
        if (typeof config.defaultValues !== "object") {
            throw new Error("The defaultValues must be an object.");
        }
    }
};

export const loadConfig = async (configPath: string): Promise<RequiredFakeServerConfig> => {
    const { default: config } = await import(configPath);
    const normalizedConfig = normalizeFakeServerConfig(config);
    validateFakeServerConfig(normalizedConfig);
    return config;
};
