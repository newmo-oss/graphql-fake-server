import path from "node:path";
import { pathToFileURL } from "node:url";
import type { RawConfig } from "@newmo/graphql-fake-core";
import type { LogLevel } from "./logger.js";

/**
 * Configuration for the fake server.
 */
export type FakeServerConfig = {
  /**
   * The path to the GraphQL schema file from cwd.
   */
  schemaFilePath: string;
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
   * The maximum number of depth of field recursion.
   * Default is 9.
   */
  maxFieldRecursionDepth?: RawConfig["maxFieldRecursionDepth"] | undefined;
  /**
   * The maximum number of depth of complexity of query
   * this value should be maxFieldRecursionDepth + 1
   * Default is 10
   */
  maxQueryDepth?: number | undefined;
  /**
   * Default values for scalar types.
   */
  defaultValues?: RawConfig["defaultValues"] | undefined;
  /**
   * Log level: "debug", "info", "warn", "error"
   * If you want to see the debug logs, set the logLevel to "debug".
   * Default is "info".
   */
  logLevel?: LogLevel | undefined;
  /**
   * Additional origins to allow for CORS requests.
   * By default, only localhost and private IP ranges are allowed.
   * This option allows you to specify additional origins to accept.
   */
  allowedCORSOrigins?: string[] | undefined;
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
  logLevel: LogLevel;
  allowedCORSOrigins: string[];
};

export const normalizeFakeServerConfig = (config: FakeServerConfig): RequiredFakeServerConfig => {
  return {
    schemaFilePath: config.schemaFilePath,
    ports: {
      fakeServer: config.ports?.fakeServer ?? 4000,
      apolloServer: config.ports?.apolloServer ?? 4002,
    },
    maxRegisteredSequences: config.maxRegisteredSequences ?? 1000,
    maxFieldRecursionDepth: config.maxFieldRecursionDepth ?? 9,
    maxQueryDepth: config.maxQueryDepth ?? 10,
    defaultValues: config.defaultValues ?? {},
    logLevel: config.logLevel ?? "info",
    allowedCORSOrigins: config.allowedCORSOrigins ?? [],
  };
};
export const validateFakeServerConfig = (config: FakeServerConfig): FakeServerConfig => {
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
  // ["debug", "info", "warn", "error"].includes(logLevel)
  if (config.logLevel && !["debug", "info", "warn", "error"].includes(config.logLevel)) {
    throw new Error("The logLevel must be one of 'debug', 'info', 'warn', 'error'.");
  }
  if (config.allowedCORSOrigins) {
    if (!Array.isArray(config.allowedCORSOrigins)) {
      throw new Error("The allowedCORSOrigins must be an array.");
    }
    for (const origin of config.allowedCORSOrigins) {
      if (typeof origin !== "string") {
        throw new Error("Each allowedCORSOrigin must be a string.");
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
