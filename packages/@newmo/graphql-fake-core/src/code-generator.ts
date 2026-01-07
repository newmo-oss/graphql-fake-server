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
export const generateExampleDirectiveCode = (exampleDirective: ExampleDirective): string => {
    if ("value" in exampleDirective) {
        return JSON.stringify(exampleDirective.value);
    }
    if ("expression" in exampleDirective) {
        return exampleDirective.expression;
    }
    throw new Error(`Invalid example directive${JSON.stringify(exampleDirective)}`);
};
export const generateEnumReferenceCode = ({
    rawTypeName,
}: {
    fieldName: string;
    rawTypeName: string;
    config: Config;
}): string => {
    // always return the first value of the enum
    return `Object.values(${rawTypeName})[0]`;
};
export const generateCreateReferenceCode = ({
    fieldName,
    rawTypeName,
    config,
}: {
    fieldName: string;
    rawTypeName: string;
    config: Config;
}): string => {
    /**
     * Track type visit count to prevent exponential explosion for recursive types.
     * Instead of using a global depth counter, we track how many times each specific type
     * has been visited in the current path.
     *
     * Example: For User -> User recursion with maxTypeRecursion=2:
     * - First User: typeVisitCount["User"] = 0, creates User
     * - Second User: typeVisitCount["User"] = 1, creates User
     * - Third User: typeVisitCount["User"] = 2, returns undefined (stops recursion)
     */
    return `((typeVisitCount["${rawTypeName}"] ?? 0) < ${config.maxTypeRecursion} ? create${rawTypeName}({ defaultFields: defaultFields?.${fieldName} ?? {}, typeVisitCount: { ...typeVisitCount, "${rawTypeName}": (typeVisitCount["${rawTypeName}"] ?? 0) + 1 } }) : undefined)`;
};

// GraphQL AST Limitations
// GraphQL ASTs do not distinguish between object references and enum references.
// https://astexplorer.net/#/gist/bbfe3f7414a904b453e173d82e836525/bab0cc96ffb951909dc3cf67a67bd67d09948be6
// so, we need to use same interface for both enum and object types
function generateEnumFactoryCode(config: ConfigWithOutput, typeInfo: EnumTypeInfo): string {
    const { rawName } = typeInfo;
    const indent = "  ";
    const isTypescript = config.outputType === "typescript";
    return `
const ${rawName} = {
${typeInfo.fields
    .map((value) => {
        const example = value.example ? generateExampleDirectiveCode(value.example) : "undefined";
        return `${indent}${value.name}: ${example},`;
    })
    .join("\n")}
}${isTypescript ? " as const" : ""};
`.trimStart();
}

function generateFactoryCode(config: ConfigWithOutput, typeInfo: ObjectTypeInfo): string {
    const { name, rawName } = typeInfo;
    const indent = "  ";
    const isTypescript = config.outputType === "typescript";
    const functionBodyCode = `
${indent}return {
${typeInfo.fields
    .map((field) => {
        const example = field.example ? generateExampleDirectiveCode(field.example) : "undefined";
        return `${indent}${indent}${field.name}: ${example},`;
    })
    .join("\n")}
${indent}};
`.trim();
    if (config.outputType === "commonjs") {
        return `
function create${rawName}({ defaultFields, typeVisitCount = Object.create(null) } = {}) {
${functionBodyCode}
}
exports.create${rawName} = create${rawName};
`.trim();
    }
    return `
export function create${rawName}({ defaultFields, typeVisitCount = Object.create(null) }${
        isTypescript
            ? `: { defaultFields?: Partial<${name}>, typeVisitCount?: Record<string, number> }`
            : ""
    } = {})${isTypescript ? `: ${name}` : ""} {
${functionBodyCode}
}
`.trimStart();
}

function generateDefaultCode(config: ConfigWithOutput, typeInfo: ObjectTypeInfo): string {
    const { rawName } = typeInfo;
    if (config.outputType === "commonjs") {
        return `const ${rawName} = create${rawName}();
exports.${rawName} = ${rawName};`;
    }
    return `export const ${rawName} = create${rawName}();`;
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
    // __id("name");
    const isTypescript = config.outputType === "typescript";
    // ${name}_g${__idGlobalId}_c${count}
    // g: global id - starts from 0
    // c: name context count - starts from 0
    return `
let __idGlobalId = 0; // global id
const __idContextCountMap = new Map${isTypescript ? "<string, number>" : ""}() // context count
function __id({ name, key }${
        isTypescript ? ": { name: string; key: string; }" : ""
    })${isTypescript ? ": string" : ""} {
    const count = __idContextCountMap.get(key) ?? 0;
    const id = name + "_g" + String(__idGlobalId) + "_c" + String(count);
    __idGlobalId += 1;
    __idContextCountMap.set(key, count + 1);
    return id;
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
    const { name, rawName } = typeInfo;
    const indent = "  ";
    const firstTypeNameOfUnionType = typeInfo.possibleRawTypeNames[0];
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
        rawTypeName: firstTypeNameOfUnionType,
        fieldName: typeInfo.rawName,
        config,
    })}
};
`.trim();
    if (config.outputType === "typescript") {
        return `
export function create${rawName}({ defaultFields, typeVisitCount = Object.create(null) }: { defaultFields?: Partial<${name}>, typeVisitCount?: Record<string, number> } = {}): ${name} {
${functionBodyCode}
}
`.trim();
    }
    return `
function create${rawName}({ defaultFields, typeVisitCount = Object.create(null) } = {}) {
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
