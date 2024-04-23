import { Config } from './config.js';
import { ExampleDirective, ObjectTypeInfo, TypeInfo } from './schema-scanner.js';

function generatePreludeCode(config: Config, typeInfos: TypeInfo[]): string {
    const joinedTypeNames = typeInfos
        .filter(({ type }) => type === 'object')
        .map(({ name }) => `  ${name}`)
        .join(',\n');
    const code = `
import type {
${joinedTypeNames},
} from '${config.typesFile}';
`.trim();
    return `${code}\n`;
}

export function generateOptionalTypeDefinitionCode(typeInfo: TypeInfo): string {
    if (typeInfo.type === 'object') {
        const { name, fields } = typeInfo;
        const comment = typeInfo.comment ?? '';
        const joinedPropDefinitions = fields
            .map((field) => {
                const comment = field.comment ? `  ${field.comment}` : '';
                return `${comment}  ${field.name}?: ${field.typeString};`;
            })
            .join('\n');
        return `
${comment}export type Optional${name} = {
${joinedPropDefinitions}
};
`.trimStart();
    } else {
        const { name, possibleTypes } = typeInfo;
        const comment = typeInfo.comment ?? '';
        const joinedPossibleTypes = possibleTypes.map((type) => `Optional${type}`).join(' | ');
        return `
${comment}export type Optional${name} = ${joinedPossibleTypes};
`.trimStart();
    }
}

function generateTypeFactoryCode({ nonOptionalDefaultFields }: Config, typeInfo: ObjectTypeInfo): string {
    const { name } = typeInfo;
    return `
/**
 * Define factory for {@link ${name}} model.
 *
 * @param options
 * @returns factory {@link ${name}FactoryInterface}
 */
export const define${name}Factory: DefineTypeFactoryInterface${nonOptionalDefaultFields ? 'Required' : ''}<
  Optional${name},
  {}
> = defineTypeFactory;
`.trimStart();
}

const handleExample = (exampleDirective: ExampleDirective): string => {
    if ("value" in exampleDirective) {
        return JSON.stringify(exampleDirective.value);
    } else if ("expression" in exampleDirective) {
        return `${exampleDirective.expression}`;
    }
    throw new Error(`Invalid example directive${JSON.stringify(exampleDirective)}`);
}

function generateExampleCode(config: Config, typeInfo: ObjectTypeInfo): string {
    const { name } = typeInfo;
    const indent = '  ';
    return `
/**
 * Default ${name} model using @example directive.
 */
export const EXAMPLE_${name}: ${name} = {
${typeInfo.fields.flatMap((field) => {
    const example = field.example;
    if (example) {
        return [`${indent}${field.name}: ${handleExample(example)}`];
    }
    return [];
}).join(',\n')}
}
/**
* Create a new ${name} model with the given options.
* @param options
*/
export function create${name}(options: Partial<${name}> = {}): ${name} {
    return { ...EXAMPLE_${name}, ...options };
}
`.trimStart();
}

export function generateCode(config: Config, typeInfos: TypeInfo[]): string {
    let code = '';
    code += generatePreludeCode(config, typeInfos);
    code += '\n';
    for (const typeInfo of typeInfos) {
        if (typeInfo.type === 'object') {
            code += generateExampleCode(config, typeInfo);
            code += '\n';
        }
    }
    return code;
}
