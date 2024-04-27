import { Config } from './config.js';
import { ExampleDirective, ObjectTypeInfo, TypeInfo } from './schema-scanner.js';

export type ConfigWithOutput = {
    outputType: "typescript" | "javascript" | "commonjs";
} & Config;
const handleExample = (exampleDirective: ExampleDirective): string => {
    if ("value" in exampleDirective) {
        return JSON.stringify(exampleDirective.value);
    } else if ("expression" in exampleDirective) {
        return exampleDirective.expression;
    }
    throw new Error(`Invalid example directive${JSON.stringify(exampleDirective)}`);
}
export const generateCreateReferenceCode = ({ fieldName, typeName, config }: {
    fieldName: string;
    typeName: string,
    config: Config
}): string => {
    /**
     * function createAuthor({ defaultFields, depth = 0 }: { defaultFields?: Partial<Author>, depth?: number } = {}): Author {
     *  return {
     *    foo: depth < 1 ? createAuthor({ defaultFields: defaultFields?.foo, depth: depth + 1 }) : undefined,
     *  }
     *}
     */
    return `(depth < ${config.maxFieldRecursionDepth} ? create${typeName}({ defaultFields: defaultFields?.${fieldName} ?? {}, depth: depth + 1 }) : undefined)`;
}

function generateExampleCode(config: ConfigWithOutput, typeInfo: ObjectTypeInfo): string {
    const { name } = typeInfo;
    const indent = '  ';
    const isTypescript = config.outputType === 'typescript';
    const functionBodyCode = `
${indent}return {
${typeInfo.fields.map(field => {
        const example = field.example ? handleExample(field.example) : 'undefined';
        return `${indent}${indent}${field.name}: ${example},`;
    }).join('\n')}
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
export function create${name}({ defaultFields, depth = 0 }${(isTypescript ? `: { defaultFields?: Partial<${name}>, depth?: number }` : "")} = {})${isTypescript ? `: ${name}Type` : ""} {
${functionBodyCode}
}
`.trimStart();
}

function generateDefaultCode(config: ConfigWithOutput, typeInfo: ObjectTypeInfo): string {
    const { name } = typeInfo;
    if (config.outputType === "commonjs") {
        return `const ${name} = create${name}();
exports.${name} = ${name};`
    }
    return `export const ${name} = create${name}();`
}

function generateImportTypeCode(config: ConfigWithOutput, typeInfos: TypeInfo[]): string {
    const isTypescript = config.outputType === 'typescript';
    if (!isTypescript) return '';
    const indent = '  ';
    const joinedTypeNames = typeInfos
        .filter(({ type }) => type === 'object')
        .map(({ name }) => `${indent}${name}`)
        .join(`,\n`);
    return `import type { 
${joinedTypeNames}
} from '${config.typesFile}';`;
}

export function generateCode(config: ConfigWithOutput, typeInfos: TypeInfo[]): string {
    let code = '';
    if (config.outputType === 'typescript') {
        code += generateImportTypeCode(config, typeInfos);
        code += '\n';
    }
    for (const typeInfo of typeInfos) {
        if (typeInfo.type === 'object') {
            code += generateExampleCode(config, typeInfo);
            code += '\n';
            code += generateDefaultCode(config, typeInfo);
            code += '\n';
        }
    }
    return code;
}
