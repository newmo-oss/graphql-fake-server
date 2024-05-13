import type { Config } from "./config.js";
import type {
    EnumTypeInfo,
    ExampleDirective,
    InterfaceTypeInfo,
    ObjectTypeInfo,
    TypeInfo,
    UnionTypeInfo,
} from "./schema-scanner.js";

export type ConfigWithOutput = {
    outputType: "typescript" | "javascript" | "commonjs";
} & Config;
const handleExample = (exampleDirective: ExampleDirective): string => {
    if ("value" in exampleDirective) {
        return JSON.stringify(exampleDirective.value);
    }
    if ("expression" in exampleDirective) {
        return exampleDirective.expression;
    }
    throw new Error(`Invalid example directive${JSON.stringify(exampleDirective)}`);
};
export const generateEnumReferenceCode = ({
    typeName,
}: {
    fieldName: string;
    typeName: string;
    config: Config;
}): string => {
    // always return the first value of the enum
    return `Object.values(${typeName})[0]`;
};
export const generateCreateReferenceCode = ({
    fieldName,
    typeName,
    config,
}: {
    fieldName: string;
    typeName: string;
    config: Config;
}): string => {
    /**
     * function createAuthor({ defaultFields, depth = 0 }: { defaultFields?: Partial<Author>, depth?: number } = {}): Author {
     *  return {
     *    foo: depth < 1 ? createAuthor({ defaultFields: defaultFields?.foo, depth: depth + 1 }) : undefined,
     *  }
     *}
     */
    return `(depth < ${config.maxFieldRecursionDepth} ? create${typeName}({ defaultFields: defaultFields?.${fieldName} ?? {}, depth: depth + 1 }) : undefined)`;
};

// GraphQL AST Limitations
// GraphQL ASTs do not distinguish between object references and enum references.
// https://astexplorer.net/#/gist/bbfe3f7414a904b453e173d82e836525/bab0cc96ffb951909dc3cf67a67bd67d09948be6
// so, we need to use same interface for both enum and object types
function generateEnumFactoryCode(config: ConfigWithOutput, typeInfo: EnumTypeInfo): string {
    const { name } = typeInfo;
    const indent = "  ";
    const isTypescript = config.outputType === "typescript";
    return `
const ${name} = {
${typeInfo.fields
    .map((value) => {
        const example = value.example ? handleExample(value.example) : "undefined";
        return `${indent}${value.name}: ${example},`;
    })
    .join("\n")}
}${isTypescript ? " as const" : ""};
`.trimStart();
}

function generateFactoryCode(config: ConfigWithOutput, typeInfo: ObjectTypeInfo): string {
    const { name } = typeInfo;
    const indent = "  ";
    const isTypescript = config.outputType === "typescript";
    const functionBodyCode = `
${indent}return {
${typeInfo.fields
    .map((field) => {
        const example = field.example ? handleExample(field.example) : "undefined";
        return `${indent}${indent}${field.name}: ${example},`;
    })
    .join("\n")}
${indent}};
`.trim();
    if (config.outputType === "commonjs") {
        return `
function create${name}({ defaultFields, depth = 0 } = {}) {
${functionBodyCode}
}
exports.create${name} = create${name};
`.trim();
    }
    return `
export function create${name}({ defaultFields, depth = 0 }${
        isTypescript ? `: { defaultFields?: Partial<${name}>, depth?: number }` : ""
    } = {})${isTypescript ? `: ${name}` : ""} {
${functionBodyCode}
}
`.trimStart();
}

function generateDefaultCode(config: ConfigWithOutput, typeInfo: ObjectTypeInfo): string {
    const { name } = typeInfo;
    if (config.outputType === "commonjs") {
        return `const ${name} = create${name}();
exports.${name} = ${name};`;
    }
    return `export const ${name} = create${name}();`;
}

function generateImportTypeCode(config: ConfigWithOutput, typeInfos: TypeInfo[]): string {
    const isTypescript = config.outputType === "typescript";
    if (!isTypescript) return "";
    const indent = "  ";
    const joinedTypeNames = typeInfos
        .filter(({ type }) => type === "object")
        .map(({ name }) => `${indent}${name}`)
        .join(",\n");
    return `import type { 
${joinedTypeNames}
} from '${config.typesFile}';`;
}

function idGeneratorCode(config: ConfigWithOutput): string {
    // __id("name);
    const isTypescript = config.outputType === "typescript";
    return `
const __idCountMap = new Map${isTypescript ? "<string, number>" : ""}()
function __id({ name, key, depth }${
        isTypescript ? ": { name: string; key: string; depth: number; }" : ""
    })${isTypescript ? ": string" : ""} {
    const count = __idCountMap.get(key) ?? 0;
    __idCountMap.set(key, count + 1);
    return name + String(depth) + String(count);
}`;
}

// Return first type of union type / interface
// union Author = User | Admin
// We can not understand which type should be returned
// As a result, we always return the first type of the union type/interface
function generateUnionOrInterfaceTypeCode(
    config: ConfigWithOutput,
    typeInfo: UnionTypeInfo | InterfaceTypeInfo,
): string {
    const { name } = typeInfo;
    const indent = "  ";
    const firstTypeNameOfUnionType = typeInfo.possibleTypes[0];
    if (!firstTypeNameOfUnionType) {
        throw new Error(`Union type ${name} has no possible types`);
    }
    // __typename is required for Union type
    // https://stackoverflow.com/questions/59519816/abstract-type-x-must-resolve-to-an-object-type-at-runtime-for-field-query-user
    // https://www.apollographql.com/docs/federation/entities/#2-define-a-reference-resolver
    const functionBodyCode = `
${indent}return {
${indent}${indent}__typename: "${firstTypeNameOfUnionType}",
${indent}${indent}...${generateCreateReferenceCode({
        typeName: firstTypeNameOfUnionType,
        fieldName: typeInfo.name,
        config,
    })}
};
`.trim();
    if (config.outputType === "typescript") {
        return `
export function create${name}({ defaultFields, depth = 0 }: { defaultFields?: Partial<${name}>, depth?: number } = {}): ${name} {
${functionBodyCode}
}
`.trim();
    }
    return `
function create${name}({ defaultFields, depth = 0 } = {}) {
${functionBodyCode}
}`;
}

export function generateCode(config: ConfigWithOutput, typeInfos: TypeInfo[]): string {
    let code = "";
    if (config.outputType === "typescript") {
        code += generateImportTypeCode(config, typeInfos);
        code += "\n";
    }
    code += idGeneratorCode(config);
    code += "\n";
    for (const typeInfo of typeInfos) {
        if (typeInfo.type === "enum") {
            code += generateEnumFactoryCode(config, typeInfo);
            code += "\n";
        }
    }
    for (const typeInfo of typeInfos) {
        if (typeInfo.type === "union" || typeInfo.type === "interface") {
            code += generateUnionOrInterfaceTypeCode(config, typeInfo);
            code += "\n";
        }
        if (typeInfo.type === "object") {
            code += generateFactoryCode(config, typeInfo);
            code += "\n";
            code += generateDefaultCode(config, typeInfo);
            code += "\n";
        }
    }
    return code;
}
