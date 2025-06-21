import type { RawTypesConfig } from "@graphql-codegen/visitor-plugin-common";

export type RawPluginConfig = {
  /**
   * The path to the generated types file
   * @example
   * typeFile: "./graphql.ts"
   **/
  typesFile: string;
  /**
   * The URL of the fake server
   * Default: 'http://127.0.0.1:4000/fake'
   */
  fakeServerEndpoint: string;
  /**
   * Naming convention for the generated types
   * GraphQL Codegen Plugin Common Options
   **/
  namingConvention?: RawTypesConfig["namingConvention"];
  /**
   * Prefix for the generated types
   * GraphQL Codegen Plugin Common Options
   **/
  typesPrefix?: RawTypesConfig["typesPrefix"];
  /**
   * Suffix for the generated types
   * GraphQL Codegen Plugin Common Options
   **/
  typesSuffix?: RawTypesConfig["typesSuffix"];
};
export type PluginConfig = Required<RawPluginConfig>;

export function normalizeConfig(rawConfig: RawPluginConfig): PluginConfig {
  return {
    typesFile: rawConfig.typesFile,
    fakeServerEndpoint: rawConfig.fakeServerEndpoint ?? "http://127.0.0.1:4000/fake",
    typesPrefix: rawConfig.typesPrefix ?? "",
    typesSuffix: rawConfig.typesSuffix ?? "",
    namingConvention: rawConfig.namingConvention ?? "",
  };
}
