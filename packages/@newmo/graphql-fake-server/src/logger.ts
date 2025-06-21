/**
 * if logLevel is debug, log all logs
 * if logLevel is info, log info, warn, error
 * if logLevel is warn, log warn, error
 * if logLevel is error, log error
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

export const createLogger = (logLevel: LogLevel = "info") => {
  return {
    debug: (...args: unknown[]) => {
      if (logLevel === "debug") {
        console.debug(...args);
      }
    },
    info: (...args: unknown[]) => {
      if (logLevel === "debug" || logLevel === "info") {
        console.info(...args);
      }
    },
    warn: (...args: unknown[]) => {
      if (logLevel === "debug" || logLevel === "info" || logLevel === "warn") {
        console.warn(...args);
      }
    },
    error: (...args: unknown[]) => {
      console.error(...args);
    },
  };
};
