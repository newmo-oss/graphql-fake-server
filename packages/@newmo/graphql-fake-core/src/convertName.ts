import { convertFactory } from "@graphql-codegen/visitor-plugin-common";
import type { ASTNode } from "graphql/index.js";
import type { Config } from "./config.js";

export function convertName(node: ASTNode | string, config: Config): string {
    const convert = config.namingConvention
        ? convertFactory({ namingConvention: config.namingConvention })
        : convertFactory({ namingConvention: "change-case-all#pascalCase" });
    let convertedName = "";
    convertedName += config.typesPrefix;
    convertedName += convert(node);
    convertedName += config.typesSuffix;
    return convertedName;
}
