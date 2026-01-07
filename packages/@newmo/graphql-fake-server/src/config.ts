import path from "node:path";
import { pathToFileURL } from "node:url";
import type { MockConfig, RawMockConfig } from "@newmo/graphql-fake-core";
import type { LogLevel } from "./logger.js";

/**
 * Server configuration options (user input - all fields optional).
 * Controls ports, request limits, and security settings.
 */
export type ServerConfig = {
    /**
     * The ports for the fake server and Apollo Server.
     */
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
     * The maximum number of depth of complexity of query
     * Default is 10
     */
    maxQueryDepth?: number | undefined;
    /**
     * Additional origins to allow for CORS requests.
     * By default, only localhost and private IP ranges are allowed.
     * This option allows you to specify additional origins to accept.
     */
    allowedCORSOrigins?: string[] | undefined;
    /**
     * Allowed Host headers for the fake server to prevent DNS rebinding attacks.
     * - "auto" (default): Automatically generates allowed hosts from CORS origins and localhost addresses
     * - string[]: Explicit list of allowed Host headers (e.g., ["localhost:4000", "myapp.local:4000"])
     * @default "auto"
     */
    allowedHosts?: string[] | "auto" | undefined;
};

/**
 * Configuration for the fake server (user input - most fields optional).
 *
 * @example
 * ```js
 * export default {
 *   schemaFilePath: "./api.graphqls",
 *   logLevel: "debug",
 *   server: {
 *     ports: { fakeServer: 4000, apolloServer: 4002 },
 *     maxQueryDepth: 10,
 *   },
 *   mock: {
 *     maxDepth: 9,
 *     maxTypeRecursion: 2,
 *     listLength: 3,
 *   },
 * };
 * ```
 */
export type FakeServerConfig = {
    /**
     * The path to the GraphQL schema file from cwd.
     * @required
     */
    schemaFilePath: string;
    /**
     * Log level for the server.
     * @default "info"
     */
    logLevel?: LogLevel | undefined;
    /**
     * Server configuration options (ports, limits, security).
     * @see ServerConfig
     */
    server?: ServerConfig | undefined;
    /**
     * Mock data generation options (depth limits, default values).
     * @see RawMockConfig from @newmo/graphql-fake-core
     */
    mock?: RawMockConfig | undefined;
};

/**
 * Server configuration (normalized - all fields required).
 * @internal
 */
export type RequiredServerConfig = {
    ports: {
        fakeServer: number;
        apolloServer: number;
    };
    maxRegisteredSequences: number;
    maxQueryDepth: number;
    allowedCORSOrigins: string[];
    allowedHosts: string[] | "auto";
};

/**
 * Mock configuration (normalized - all fields required).
 * @internal
 */
export type RequiredMockConfig = MockConfig;

/**
 * Fake server configuration (normalized - all fields required).
 * This is the internal config type with defaults applied.
 *
 * @see FakeServerConfig for user-facing config with optional fields
 * @internal
 */
export type RequiredFakeServerConfig = {
    schemaFilePath: string;
    logLevel: LogLevel;
    server: RequiredServerConfig;
    mock: RequiredMockConfig;
};

/**
 * Default values for server configuration.
 * @internal
 */
const ServerDefaults = {
    ports: {
        fakeServer: 4000,
        apolloServer: 4002,
    },
    maxRegisteredSequences: 1000,
    maxQueryDepth: 10,
    allowedCORSOrigins: [] as string[],
    allowedHosts: "auto" as const,
} as const;

/**
 * Default log level.
 * @internal
 */
const LogLevelDefault = "info" as LogLevel;

/**
 * Default values for mock generation options.
 * @see RawMockConfig
 * @internal
 */
const MockDefaultValues = {
    maxDepth: 9,
    maxTypeRecursion: 2,
    listLength: 3,
} as const;

/**
 * Default values for GraphQL scalar types.
 * @internal
 */
const ScalarDefaults = {
    String: "string",
    Int: 12,
    Float: 12.3,
    Boolean: true,
    ID: "xxxx-xxxx-xxxx-xxxx",
} as const;

export const normalizeFakeServerConfig = (config: FakeServerConfig): RequiredFakeServerConfig => {
    return {
        schemaFilePath: config.schemaFilePath,
        logLevel: config.logLevel ?? LogLevelDefault,
        server: {
            ports: {
                fakeServer: config.server?.ports?.fakeServer ?? ServerDefaults.ports.fakeServer,
                apolloServer:
                    config.server?.ports?.apolloServer ?? ServerDefaults.ports.apolloServer,
            },
            maxRegisteredSequences:
                config.server?.maxRegisteredSequences ?? ServerDefaults.maxRegisteredSequences,
            maxQueryDepth: config.server?.maxQueryDepth ?? ServerDefaults.maxQueryDepth,
            allowedCORSOrigins:
                config.server?.allowedCORSOrigins ?? ServerDefaults.allowedCORSOrigins,
            allowedHosts: config.server?.allowedHosts ?? ServerDefaults.allowedHosts,
        },
        mock: {
            maxDepth: config.mock?.maxDepth ?? MockDefaultValues.maxDepth,
            maxTypeRecursion: config.mock?.maxTypeRecursion ?? MockDefaultValues.maxTypeRecursion,
            listLength: config.mock?.listLength ?? MockDefaultValues.listLength,
            defaultValues: {
                String: config.mock?.defaultValues?.String ?? ScalarDefaults.String,
                Int: config.mock?.defaultValues?.Int ?? ScalarDefaults.Int,
                Float: config.mock?.defaultValues?.Float ?? ScalarDefaults.Float,
                Boolean: config.mock?.defaultValues?.Boolean ?? ScalarDefaults.Boolean,
                ID: config.mock?.defaultValues?.ID ?? ScalarDefaults.ID,
                CustomScalar: config.mock?.defaultValues?.CustomScalar ?? {},
            },
        },
    };
};

export const validateFakeServerConfig = (config: FakeServerConfig): FakeServerConfig => {
    if (!config.schemaFilePath) {
        throw new Error("The schemaFilePath is required.");
    }
    if (typeof config.schemaFilePath !== "string") {
        throw new Error("The schemaPath must be a string.");
    }
    // logLevel validation
    if (config.logLevel && !["debug", "info", "warn", "error"].includes(config.logLevel)) {
        throw new Error("The logLevel must be one of 'debug', 'info', 'warn', 'error'.");
    }
    // Server validation
    if (config.server) {
        if (typeof config.server !== "object") {
            throw new Error("The server must be an object.");
        }
        if (config.server.ports) {
            if (typeof config.server.ports !== "object") {
                throw new Error("The server.ports must be an object.");
            }
            if (
                config.server.ports.fakeServer &&
                typeof config.server.ports.fakeServer !== "number"
            ) {
                throw new Error("The server.ports.fakeServer must be a number.");
            }
            if (
                config.server.ports.apolloServer &&
                typeof config.server.ports.apolloServer !== "number"
            ) {
                throw new Error("The server.ports.apolloServer must be a number.");
            }
        }
        if (
            config.server.maxRegisteredSequences &&
            typeof config.server.maxRegisteredSequences !== "number"
        ) {
            throw new Error("The server.maxRegisteredSequences must be a number.");
        }
        if (config.server.maxQueryDepth && typeof config.server.maxQueryDepth !== "number") {
            throw new Error("The server.maxQueryDepth must be a number.");
        }
        if (config.server.allowedCORSOrigins) {
            if (!Array.isArray(config.server.allowedCORSOrigins)) {
                throw new Error("The server.allowedCORSOrigins must be an array.");
            }
            for (const origin of config.server.allowedCORSOrigins) {
                if (typeof origin !== "string") {
                    throw new Error("Each server.allowedCORSOrigin must be a string.");
                }
            }
        }
        if (config.server.allowedHosts) {
            if (
                config.server.allowedHosts !== "auto" &&
                !Array.isArray(config.server.allowedHosts)
            ) {
                throw new Error("The server.allowedHosts must be 'auto' or an array of strings.");
            }
            if (Array.isArray(config.server.allowedHosts)) {
                for (const host of config.server.allowedHosts) {
                    if (typeof host !== "string") {
                        throw new Error("Each server.allowedHost must be a string.");
                    }
                }
            }
        }
    }
    // Mock validation
    if (config.mock) {
        if (typeof config.mock !== "object") {
            throw new Error("The mock must be an object.");
        }
        if (config.mock.maxDepth !== undefined) {
            if (typeof config.mock.maxDepth !== "number") {
                throw new Error("The mock.maxDepth must be a number.");
            }
            if (config.mock.maxDepth < 1) {
                throw new Error("The mock.maxDepth must be at least 1.");
            }
        }
        if (config.mock.maxTypeRecursion !== undefined) {
            if (typeof config.mock.maxTypeRecursion !== "number") {
                throw new Error("The mock.maxTypeRecursion must be a number.");
            }
            if (config.mock.maxTypeRecursion < 1) {
                throw new Error("The mock.maxTypeRecursion must be at least 1.");
            }
        }
        if (config.mock.listLength !== undefined && typeof config.mock.listLength !== "number") {
            throw new Error("The mock.listLength must be a number.");
        }
        if (config.mock.defaultValues) {
            if (typeof config.mock.defaultValues !== "object") {
                throw new Error("The mock.defaultValues must be an object.");
            }
        }
    }
    return config;
};

/**
 * Load the fake server configuration from the file.
 * @param configPath
 */
export const loadConfig = async (
    cwd: string,
    configPath: string,
): Promise<RequiredFakeServerConfig> => {
    const fileUrl = pathToFileURL(path.resolve(cwd, configPath)).href;
    const { default: config } = await import(fileUrl);
    const normalizedConfig = normalizeFakeServerConfig(config);
    validateFakeServerConfig(normalizedConfig);
    return normalizedConfig;
};

/**
 * Load the fake server configuration from the CLI flags.
 * @param cliFlag
 */
export const loadFakeServerConfigFromCLI = ({
    schemaFilePath,
    logLevel,
}: {
    schemaFilePath?: string | undefined;
    logLevel?: LogLevel | undefined;
}): RequiredFakeServerConfig => {
    if (!schemaFilePath) {
        throw new Error(
            "The --schema is required. or pass --config ./fake-server.config.js to load the config file.",
        );
    }
    const normalizedConfig = normalizeFakeServerConfig({
        schemaFilePath,
        logLevel,
    });
    validateFakeServerConfig(normalizedConfig);
    return normalizedConfig;
};
