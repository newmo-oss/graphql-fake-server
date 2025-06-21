import { convertFactory } from "@graphql-codegen/visitor-plugin-common";
import type { ASTNode } from "graphql/index.js";
import type { PluginConfig } from "./config";

export function convertName(node: ASTNode | string, config: PluginConfig): string {
  const convert = config.namingConvention
    ? convertFactory({ namingConvention: config.namingConvention })
    : convertFactory({});
  let convertedName = "";
  convertedName += config.typesPrefix;
  convertedName += convert(node);
  convertedName += config.typesSuffix;
  return convertedName;
}
