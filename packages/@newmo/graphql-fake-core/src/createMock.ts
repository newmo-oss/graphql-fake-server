import vm from "node:vm";
import type { GraphQLSchema } from "graphql/index.js";
import { generateCode } from "./code-generator.js";
import { normalizeConfig, type RawConfig } from "./config.js";
import { getTypeInfos, type TypeInfo } from "./schema-scanner.js";

export type MockObject = Record<string, unknown>;
/**
 * Factory function that creates a mock instance for a type.
 * Each call generates a fresh instance with unique IDs.
 * Pass `{ depth: maxDepth }` or higher to get scalar-only fields without recursive expansion.
 */
export type MockFactory = (opts?: {
    depth?: number;
    defaultFields?: Record<string, unknown>;
}) => Record<string, unknown>;
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
    const result: Record<string, unknown> = Object.create(null);
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
          /**
           * Factory functions keyed by type name (e.g., "Organization").
           * Each factory creates a fresh mock instance with unique IDs.
           * Used by the server for lazy mock resolution with @graphql-tools/mock.
           */
          factories: Record<string, MockFactory>;
          /**
           * Fields that are intentionally empty arrays (e.g., @error directive).
           * Map of typeName -> Set of fieldNames.
           * The server should NOT generate list resolvers for these fields.
           */
          emptyListFields: Map<string, Set<string>>;
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
    const normalizedConfig = normalizeConfig(rawConfig);
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
        const exports: Record<string, unknown> = {};
        vm.runInNewContext(code, { exports });

        // Separate factory functions and static instances from exports
        const factories: Record<string, MockFactory> = {};
        for (const [key, value] of Object.entries(exports)) {
            if (typeof value === "function" && key.startsWith("create")) {
                const typeName = key.slice("create".length);
                factories[typeName] = value as MockFactory;
            }
        }

        // Detect fields intentionally set to empty arrays (e.g., @error directive).
        // These should not be overridden by lazy list resolvers in the server.
        const emptyListFields = new Map<string, Set<string>>();
        for (const typeInfo of typeInfos) {
            if (typeInfo.type !== "object") continue;
            for (const field of typeInfo.fields) {
                if (
                    field.example &&
                    "value" in field.example &&
                    Array.isArray(field.example.value) &&
                    field.example.value.length === 0
                ) {
                    let fieldSet = emptyListFields.get(typeInfo.rawName);
                    if (!fieldSet) {
                        fieldSet = new Set();
                        emptyListFields.set(typeInfo.rawName, fieldSet);
                    }
                    fieldSet.add(field.name);
                }
            }
        }

        // Static instances: strip functions/undefined for backward compatibility
        const plainObject = cloneAsJSON(exports) as MockObject;
        return {
            ok: true,
            code,
            mock: plainObject,
            factories,
            emptyListFields,
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
