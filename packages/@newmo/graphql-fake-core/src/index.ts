export type { ConfigWithOutput } from "./code-generator.js";
export { generateCode } from "./code-generator.js";
export type { Config, RawConfig } from "./config.js";
export { normalizeConfig, validateConfig } from "./config.js";
export type { CreateMockOptions, CreateMockResult, MockObject } from "./createMock.js";
export { createMock } from "./createMock.js";
export { EXAMPLE_DIRECTIVE, extendSchema } from "./extend-schema.js";
export type {
  ExampleDirectionExpression,
  ExampleDirective,
  ExampleDirectiveValue,
  InterfaceTypeInfo,
  ObjectTypeInfo,
  TypeInfo,
} from "./schema-scanner.js";
export { getTypeInfos } from "./schema-scanner.js";
