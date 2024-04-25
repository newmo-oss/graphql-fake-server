import { transformComment } from '@graphql-codegen/visitor-plugin-common';
import {
    ASTNode,
    ConstValueNode,
    FieldDefinitionNode,
    GraphQLSchema,
    InputObjectTypeDefinitionNode,
    InputValueDefinitionNode,
    InterfaceTypeDefinitionNode,
    Kind,
    ListTypeNode,
    NamedTypeNode,
    NonNullTypeNode,
    ObjectTypeDefinitionNode,
    TypeNode,
    UnionTypeDefinitionNode,
} from 'graphql';
import { Config } from './config.js';
// The fork of https://github.com/dotansimha/graphql-code-generator/blob/e1dc75f3c598bf7f83138ca533619716fc73f823/packages/plugins/typescript/resolvers/src/visitor.ts#L85-L91

// The fork of https://github.com/dotansimha/graphql-code-generator/blob/ba84a3a2758d94dac27fcfbb1bafdf3ed7c32929/packages/plugins/other/visitor-plugin-common/src/base-visitor.ts#L422
function convertName(node: ASTNode | string, config: Config): string {
    let convertedName = '';
    convertedName += config.typesPrefix;
    convertedName += config.convert(node);
    convertedName += config.typesSuffix;
    return convertedName;
}

const parseTypeNodeStructure = (node: TypeNode): string => {
    if (node.kind === Kind.NON_NULL_TYPE) {
        return parseTypeNodeStructure(node.type);
    } else if (node.kind === Kind.LIST_TYPE) {
        return `array`
    } else {
        // string, number, boolean, null
        if (node.name.value === "String") {
            return "string"
        }
        if (node.name.value === "Int") {
            return "number"
        }
        if (node.name.value === "Float") {
            return "number"
        }
        if (node.name.value === "Boolean") {
            return "boolean"
        }
        if (node.name.value === "ID") {
            return "string"
        }
        return `object`
    }
}
type ValuePrimitive = string | number | boolean | null;
type ValueArray = ValuePrimitive[];
type ValueObject = Record<string, ValuePrimitive | ValueArray>;
export type ExampleDirectiveValue = {
    value: ValuePrimitive | ValueArray | ValueObject
};
export type ExampleDirectionExpresion = {
    expression: string
}
export type ExampleDirective = ExampleDirectiveValue | ExampleDirectionExpresion;

function valueOf(value: ConstValueNode): ValuePrimitive | ValueArray | ValueObject {
    // object
    if (value.kind === Kind.OBJECT) {
        return value.fields.reduce((acc, field) => {
            // @ts-expect-error TODO: nesting type
            acc[field.name.value] = valueOf(field.value)
            return acc
        }, {} as ValueObject)
    }
    // list
    if (value.kind === Kind.LIST) {
        return value.values.map(v => {
            return valueOf(v)
        }) as ValueArray
    }
    // null
    if (value.kind === Kind.NULL) {
        return null
    }
    // string
    if (value.kind === Kind.STRING) {
        return value.value
    }
    // enum
    if (value.kind === Kind.ENUM) {
        return value.value
    }
    // int
    if (value.kind === Kind.INT) {
        return Number.parseInt(value.value, 10)
    }
    // float
    if (value.kind === Kind.FLOAT) {
        return Number.parseFloat(value.value)
    }
    // boolean
    if (value.kind === Kind.BOOLEAN) {
        return value.value
    }
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    throw new Error(`Unknown kind of value ${value satisfies never}`)
}

const typeToFunction = (type: string, config: Config): string => {
    switch (type) {
        case "String":
            return `"${config.defaultValues.String}"`
        case "Int":
            return `${config.defaultValues.Int}`
        case "Float":
            return `${config.defaultValues.Float}`
        case "Boolean":
            return `${config.defaultValues.Boolean ? "true" : "false"}`
        case "ID":
            return `"${config.defaultValues.ID}"`
        default:
            // reference to the object
            return `${type}`;
    }
}
const typeToFunctionWithArray = (type: string, config: Config): string => {
    return `Array.from({ length: ${config.defaultValues.listLength} }).map(() => ${typeToFunction(type, config)})`
}
// NamedType/ListType handling
const nodeToExpression = ({ currentNode, isArray = false, config }: {
    currentNode: NonNullTypeNode | NamedTypeNode | ListTypeNode,
    config: Config
    isArray?: boolean,
}): ExampleDirectionExpresion => {
    if (currentNode.kind === "NonNullType") {
        return nodeToExpression({
            currentNode:
            currentNode.type, isArray, config
        });
    } else if (currentNode.kind === "NamedType") {
        if (isArray) {
            return {
                expression: typeToFunctionWithArray(currentNode.name.value, config)
            }
        } else {
            return {
                expression: typeToFunction(currentNode.name.value, config)
            }
        }
    } else if (currentNode.kind === "ListType") {
        return nodeToExpression({ currentNode: currentNode.type, isArray: true, config })
    }
    throw new Error("Unknown node kind")
}

function parseFieldOrInputValueDefinition(
    node: FieldDefinitionNode | InputValueDefinitionNode,
    convertedTypeName: string,
    config: Config,
): { example?: ExampleDirective | undefined } {
    const exampleDirective = node.directives?.find(d => d.name.value === "example");
    // fake
    // if @example directive is not found, return random value for the scalar type
    if (!exampleDirective) {
        return {
            example: nodeToExpression({ currentNode: node.type, config })
        };
    }
    if (!exampleDirective.arguments) {
        throw new Error("@example directive must have arguments")
    }
    /**
     * @example(value: "value")
     * -> { value: "value" }
     */
    const value = exampleDirective.arguments.find(a => a.name.value === "value");
    if (value) {
        // if node type is not equal to the value type, throw an error
        const rawValue = valueOf(value.value);
        const nodeType = parseTypeNodeStructure(node.type);
        const fieldName = node.name.value;
        // array, object, string, number, boolean, null
        const rawValueType = Object.prototype.toString.call(rawValue).slice(8, -1).toLowerCase();
        if (nodeType !== rawValueType) {
            throw new Error(`${convertedTypeName}.${fieldName}: @example directive value type must be ${nodeType}. @example(value: ${nodeType})`)
        }
        return { example: { value: rawValue } }
    }
    throw new Error(`@example directive must have value argument. @example(value: "value")`)
}

function parseObjectTypeOrInputObjectTypeDefinition(
    node: ObjectTypeDefinitionNode | InputObjectTypeDefinitionNode,
    config: Config,
): ObjectTypeInfo {
    const originalTypeName = node.name.value;
    const convertedTypeName = convertName(originalTypeName, config);
    return {
        type: 'object',
        name: originalTypeName,
        fields: [
            ...(node.fields ?? []).map((field) => ({
                name: field.name.value,
                ...parseFieldOrInputValueDefinition(field, convertedTypeName, config),
            })),
        ],
    };
}

type FieldInfo = {
    name: string;
    example?: ExampleDirective | undefined;
}
export type ObjectTypeInfo = {
    type: 'object';
    name: string;
    fields: FieldInfo[];
};
export type AbstractTypeInfo = {
    type: 'abstract';
    name: string;
    possibleTypes: string[];
    comment?: string | undefined;
    example?: ExampleDirective | undefined
};
export type TypeInfo = ObjectTypeInfo | AbstractTypeInfo;

export function getTypeInfos(config: Config, schema: GraphQLSchema): TypeInfo[] {
    const types = Object.values(schema.getTypeMap());

    const userDefinedTypeDefinitions = types
        .map((type) => type.astNode)
        .filter(
            (
                node,
            ): node is
                | ObjectTypeDefinitionNode
                | InputObjectTypeDefinitionNode
                | InterfaceTypeDefinitionNode
                | UnionTypeDefinitionNode => {
                if (!node) return false;
                return (
                    node.kind === Kind.OBJECT_TYPE_DEFINITION ||
                    node.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ||
                    node.kind === Kind.INTERFACE_TYPE_DEFINITION ||
                    node.kind === Kind.UNION_TYPE_DEFINITION
                );
            },
        );
    const objectTypeDefinitions = userDefinedTypeDefinitions.filter((node): node is ObjectTypeDefinitionNode => {
        if (!node) return false;
        return node.kind === Kind.OBJECT_TYPE_DEFINITION;
    });

    return types
        .map((type) => type.astNode)
        .filter(
            (
                node,
            ): node is
                | ObjectTypeDefinitionNode
                | InputObjectTypeDefinitionNode
                | InterfaceTypeDefinitionNode
                | UnionTypeDefinitionNode => {
                if (!node) return false;
                return (
                    node.kind === Kind.OBJECT_TYPE_DEFINITION ||
                    node.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ||
                    node.kind === Kind.INTERFACE_TYPE_DEFINITION ||
                    node.kind === Kind.UNION_TYPE_DEFINITION
                );
            },
        )
        .map((node) => {
            if (node?.kind === Kind.OBJECT_TYPE_DEFINITION || node?.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
                return parseObjectTypeOrInputObjectTypeDefinition(node, config);
            } else if (node?.kind === Kind.INTERFACE_TYPE_DEFINITION) {
                return {
                    type: 'abstract',
                    name: convertName(node.name.value, config),
                    possibleTypes: objectTypeDefinitions
                        .filter((objectTypeDefinitionNode) =>
                            (objectTypeDefinitionNode.interfaces ?? []).some((i) => i.name.value === node.name.value),
                        )
                        .map((objectTypeDefinitionNode) => convertName(objectTypeDefinitionNode.name.value, config)),
                    comment: node.description ? transformComment(node.description) : undefined,
                };
            } else {
                return {
                    type: 'abstract',
                    name: convertName(node.name.value, config),
                    possibleTypes: (node.types ?? []).map((type) => convertName(type.name.value, config)),
                    comment: node.description ? transformComment(node.description) : undefined,
                };
            }
        });
}
