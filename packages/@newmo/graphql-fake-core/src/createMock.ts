import vm from "node:vm";
import type { GraphQLSchema } from "graphql/index.js";
import { generateCode } from "./code-generator.js";
import { normalizeConfig } from "./config.js";
import { getTypeInfos } from "./schema-scanner.js";

export type MockObject = Record<string, unknown>;
export type CreateMockOptios = {
    schema: GraphQLSchema;
    maxFieldRecursionDepth?: number | undefined;
};
const cloneAsJSON = (obj: unknown) => {
    return JSON.parse(JSON.stringify(obj));
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
          mock: MockObject;
          error: Error;
      };
/**
 * Create mock object from schema
 * It supports @example directive
 */
export const createMock = async (options: CreateMockOptios): Promise<CreateMockResult> => {
    const normalizedConfig = normalizeConfig({
        maxFieldRecursionDepth: options.maxFieldRecursionDepth ?? 3,
    });
    const typeInfos = getTypeInfos(normalizedConfig, options.schema);
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
            mock: {},
            error: error as Error,
        };
    }
};
