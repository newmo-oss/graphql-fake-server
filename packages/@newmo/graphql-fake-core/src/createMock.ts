import vm from "node:vm";
import type { GraphQLSchema } from "graphql/index.js";
import { generateCode } from "./code-generator.js";
import { normalizeConfig, type RawConfig } from "./config.js";
import { getTypeInfos, type TypeInfo } from "./schema-scanner.js";

export type MockObject = Record<string, unknown>;
export type CreateMockOptions = {
    schema: GraphQLSchema;
} & Partial<RawConfig>;
const cloneAsJSON = (obj: unknown): unknown => {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map((item) => cloneAsJSON(item));
    }
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
        const value = (obj as Record<string, unknown>)[key];
        // JSON.stringify と同じ: function と undefined をスキップ
        if (typeof value === "function" || typeof value === "undefined") {
            continue;
        }
        result[key] = cloneAsJSON(value);
    }
    return result;
};
export type CreateMockResult =
    | {
          ok: true;
          code: string;
          mock: MockObject;
      }
    | {
          ok: false;
          code: string;
          typeInfos: TypeInfo[];
          error: Error;
      };
/**
 * Create mock object from schema
 * It supports @example directive
 */
export const createMock = async (options: CreateMockOptions): Promise<CreateMockResult> => {
    const { schema, ...rawConfig } = options;
    const normalizedConfig = normalizeConfig({
        maxFieldRecursionDepth: rawConfig.maxFieldRecursionDepth ?? 3,
        ...rawConfig,
    });
    const typeInfos = getTypeInfos(normalizedConfig, schema);
    const code = generateCode(
        {
            ...normalizedConfig,
            outputType: "commonjs",
        },
        typeInfos,
    );

    try {
        // execute code in vm and get all exports
        const exports = {};
        vm.runInNewContext(code, { exports });
        // Apollo Server does not support Function type in mock object
        const plainObject = cloneAsJSON(exports);
        return {
            ok: true,
            code,
            mock: plainObject,
        };
    } catch (error) {
        return {
            ok: false,
            code,
            typeInfos,
            error: error as Error,
        };
    }
};
