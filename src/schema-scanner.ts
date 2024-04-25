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

const createIDFactory = () => {
    const idMap = new Map<string, number>();
    return (name: string) => {
        const count = idMap.get(name) ?? 0;
        idMap.set(name, count + 1);
        return `${name}${count}`;
    }
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

const typeToFunction = (type: string, config: Config, idFactory: ReturnType<typeof createIDFactory>): string => {
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
            return `"${config.defaultValues.ID}${idFactory(config.defaultValues.ID)}"`
        default:
            // reference to the object
            return `${type}`;
    }
}
const typeToFunctionWithArray = (type: string, config: Config, idFactory: ReturnType<typeof createIDFactory>): string => {
    return `Array.from({ length: ${config.defaultValues.listLength} }).map(() => ${typeToFunction(type, config, idFactory)})`
}
// NamedType/ListType handling
const nodeToExpression = ({ currentNode, isArray = false, config, idFactory }: {
    currentNode: NonNullTypeNode | NamedTypeNode | ListTypeNode,
    config: Config
    isArray?: boolean,
    idFactory: ReturnType<typeof createIDFactory>
}): ExampleDirectionExpresion => {
    if (currentNode.kind === "NonNullType") {
        return nodeToExpression({
            currentNode:
            currentNode.type,
            isArray,
            config,
            idFactory
        });
    } else if (currentNode.kind === "NamedType") {
        if (isArray) {
            return {
                expression: typeToFunctionWithArray(currentNode.name.value, config, idFactory)
            }
        } else {
            return {
                expression: typeToFunction(currentNode.name.value, config, idFactory)
            }
        }
    } else if (currentNode.kind === "ListType") {
        return nodeToExpression({ currentNode: currentNode.type, isArray: true, config, idFactory })
    }
    throw new Error("Unknown node kind")
}

const SUPPORTED_EXAMPLE_DIRECTIVES = ["exampleID", "exampleString", "exampleInt", "exampleFloat", "exampleBoolean"];
const isIdType = (node: NonNullTypeNode | NamedTypeNode | ListTypeNode): boolean => {
    if (node.kind === "NonNullType") {
        return isIdType(node.type)
    } else if (node.kind === "NamedType") {
        return node.name.value === "ID"
    } else if (node.kind === "ListType") {
        return false
    }
    return false
}

function parseFieldOrInputValueDefinition(
    { node, convertedTypeName, config, idFactory }: {
        node: FieldDefinitionNode | InputValueDefinitionNode,
        convertedTypeName: string,
        config: Config;
        idFactory: ReturnType<typeof createIDFactory>
    },
): { example?: ExampleDirective | undefined } {
    const exampleDirective = node.directives?.find(d => {
        return SUPPORTED_EXAMPLE_DIRECTIVES.includes(d.name.value)
    });
    // fake
    // if @example directive is not found, return random value for the scalar type
    if (!exampleDirective) {
        return {
            example: nodeToExpression({ currentNode: node.type, config, idFactory })
        };
    }
    if (!exampleDirective.arguments) {
        throw new Error("@example directive must have arguments")
    }
    /**
     * @exampleID(value: "id")
     * -> { value: "id1" }
     * @exampleString(value: "value")
     * -> { value: "value" }
     * @exampleInt(value: 1)
     * -> { value: 1 }
     * @exampleFloat(value: 1.1)
     * -> { value: 1.1 }
     * @exampleBoolean(value: true)
     * -> { value: true }
     */
    const value = exampleDirective.arguments.find(a => a.name.value === "value");
    if (!value) {
        throw new Error(`@${exampleDirective.name.value} directive must have value argument.`)
    }
    const rawValue = valueOf(value.value);
    // if node type is not equal to the value type, throw an error
    const nodeType = parseTypeNodeStructure(node.type);
    const fieldName = node.name.value;
    // array, object, string, number, boolean, null
    const rawValueType = Object.prototype.toString.call(rawValue).slice(8, -1).toLowerCase();
    if (nodeType !== rawValueType) {
        throw new Error(`${convertedTypeName}.${fieldName}: @${exampleDirective.name.value} directive value type must be ${nodeType}. Got ${rawValueType}`)
    }
    // if ID type, add idFactory() to the value
    // e.g. @exampleID(value: "id") -> { value: "id1" }
    const exmpleValue = isIdType(node.type) && typeof rawValue === "string" ? `${rawValue}${idFactory(rawValue)}` : rawValue;
    return { example: { value: exmpleValue } }
}

function parseObjectTypeOrInputObjectTypeDefinition(
    { node, config, idFactory }: {
        node: ObjectTypeDefinitionNode | InputObjectTypeDefinitionNode,
        config: Config;
        idFactory: ReturnType<typeof createIDFactory>
    },
): ObjectTypeInfo {
    const originalTypeName = node.name.value;
    const convertedTypeName = convertName(originalTypeName, config);
    return {
        type: 'object',
        name: originalTypeName,
        fields: [
            ...(node.fields ?? []).map((field) => ({
                name: field.name.value,
                ...parseFieldOrInputValueDefinition({
                    node: field,
                    convertedTypeName,
                    config,
                    idFactory
                }),
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

    const idFactory = createIDFactory();
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
                return parseObjectTypeOrInputObjectTypeDefinition({ node, config, idFactory });
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
