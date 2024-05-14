import { convertFactory, transformComment } from "@graphql-codegen/visitor-plugin-common";
import {
    type ASTNode,
    type ConstValueNode,
    type EnumTypeDefinitionNode,
    type FieldDefinitionNode,
    type GraphQLSchema,
    type InputObjectTypeDefinitionNode,
    type InputValueDefinitionNode,
    type InterfaceTypeDefinitionNode,
    Kind,
    type ListTypeNode,
    type NamedTypeNode,
    type NonNullTypeNode,
    type ObjectTypeDefinitionNode,
    type TypeNode,
    type UnionTypeDefinitionNode,
} from "graphql";
import { generateCreateReferenceCode, generateEnumReferenceCode } from "./code-generator.js";
import type { Config } from "./config.js";

function convertName(node: ASTNode | string, config: Config): string {
    const convert = config.namingConvention
        ? convertFactory({ namingConvention: config.namingConvention })
        : convertFactory({});
    let convertedName = "";
    convertedName += config.typesPrefix;
    convertedName += convert(node);
    convertedName += config.typesSuffix;
    return convertedName;
}

const createIDFactory = () => {
    return (name: string, key: string) => {
        return `__id({ name: "${name}", key:"${key}", depth })`;
    };
};

const parseTypeNodeStructure = (node: TypeNode): string => {
    if (node.kind === Kind.NON_NULL_TYPE) {
        return parseTypeNodeStructure(node.type);
    }
    if (node.kind === Kind.LIST_TYPE) {
        return "array";
    }
    // string, number, boolean, null
    if (node.name.value === "String") {
        return "string";
    }
    if (node.name.value === "Int") {
        return "number";
    }
    if (node.name.value === "Float") {
        return "number";
    }
    if (node.name.value === "Boolean") {
        return "boolean";
    }
    if (node.name.value === "ID") {
        return "string";
    }
    // enum - treat as string
    if (node.kind === Kind.NAMED_TYPE) {
        return "string";
    }
    return "object";
};
type ValuePrimitive = string | number | boolean | null;
type ValueArray = ValuePrimitive[];
type ValueObject = Record<string, ValuePrimitive | ValueArray>;
export type ExampleDirectiveValue = {
    // value is serialized value
    value: ValuePrimitive | ValueArray | ValueObject;
};
export type ExampleDirectionExpression = {
    expression: string;
};
export type ExampleDirective = ExampleDirectiveValue | ExampleDirectionExpression;

function valueOfNode(value: ConstValueNode): ValuePrimitive | ValueArray | ValueObject {
    // object
    if (value.kind === Kind.OBJECT) {
        return value.fields.reduce((acc, field) => {
            // @ts-expect-error TODO: nesting type
            acc[field.name.value] = valueOfNode(field.value);
            return acc;
        }, {} as ValueObject);
    }
    // list
    if (value.kind === Kind.LIST) {
        return value.values.map((v) => {
            return valueOfNode(v);
        }) as ValueArray;
    }
    // null
    if (value.kind === Kind.NULL) {
        return null;
    }
    // string
    if (value.kind === Kind.STRING) {
        return value.value;
    }
    // enum
    if (value.kind === Kind.ENUM) {
        return value.value;
    }
    // int
    if (value.kind === Kind.INT) {
        return Number.parseInt(value.value, 10);
    }
    // float
    if (value.kind === Kind.FLOAT) {
        return Number.parseFloat(value.value);
    }
    // boolean
    if (value.kind === Kind.BOOLEAN) {
        return value.value;
    }
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    throw new Error(`Unknown kind of value ${value satisfies never}`);
}

const typeToFunction = ({
    convertedTypeName,
    fieldName,
    type,
    config,
    idFactory,
    enumMap,
}: {
    convertedTypeName: string;
    fieldName: string;
    type: string;
    config: Config;
    idFactory: ReturnType<typeof createIDFactory>;
    enumMap: EnumMap;
}): string => {
    switch (type) {
        case "String":
            return `"${config.defaultValues.String}"`;
        case "Int":
            return `${config.defaultValues.Int}`;
        case "Float":
            return `${config.defaultValues.Float}`;
        case "Boolean":
            return `${config.defaultValues.Boolean ? "true" : "false"}`;
        case "ID": {
            const pathOfField = `${convertedTypeName}.${fieldName}`;
            return `${idFactory(config.defaultValues.ID, pathOfField)}`;
        }
        default: {
            // if enum type(name is equaled) is defined, reference to the enum
            if (enumMap.has(type)) {
                return `${generateEnumReferenceCode({
                    fieldName,
                    typeName: type,
                    config: config,
                })}`;
            }
            // reference to the object
            return `${generateCreateReferenceCode({ fieldName, typeName: type, config: config })}`;
        }
    }
};
const typeToFunctionWithArray = ({
    convertedTypeName,
    fieldName,
    type,
    config,
    idFactory,
    enumMap,
}: {
    convertedTypeName: string;
    fieldName: string;
    type: string;
    config: Config;
    idFactory: ReturnType<typeof createIDFactory>;
    enumMap: EnumMap;
}): string => {
    // Avoid [null, null, null]
    // Mock server can't handle null values in the array
    return `(depth < ${config.maxFieldRecursionDepth}) ? Array.from({ length: ${
        config.defaultValues.listLength
    } }).map(() => ${typeToFunction({
        convertedTypeName,
        fieldName: fieldName,
        type: type,
        config: config,
        idFactory: idFactory,
        enumMap,
    })}) : []`;
};
// NamedType/ListType handling
const nodeToExpression = ({
    convertedTypeName,
    fieldName,
    currentNode,
    isArray = false,
    config,
    idFactory,
    enumMap,
}: {
    convertedTypeName: string;
    fieldName: string;
    currentNode: NonNullTypeNode | NamedTypeNode | ListTypeNode;
    config: Config;
    isArray?: boolean;
    idFactory: ReturnType<typeof createIDFactory>;
    enumMap: EnumMap;
}): ExampleDirectionExpression => {
    if (currentNode.kind === "NonNullType") {
        return nodeToExpression({
            convertedTypeName,
            fieldName,
            currentNode: currentNode.type,
            isArray,
            config,
            idFactory,
            enumMap,
        });
    }
    if (currentNode.kind === "NamedType") {
        if (isArray) {
            return {
                expression: typeToFunctionWithArray({
                    convertedTypeName,
                    fieldName: fieldName,
                    type: currentNode.name.value,
                    config: config,
                    idFactory: idFactory,
                    enumMap,
                }),
            };
        }
        return {
            expression: typeToFunction({
                convertedTypeName,
                fieldName,
                type: currentNode.name.value,
                config: config,
                idFactory: idFactory,
                enumMap,
            }),
        };
    }
    if (currentNode.kind === "ListType") {
        return nodeToExpression({
            convertedTypeName,
            fieldName,
            currentNode: currentNode.type,
            isArray: true,
            config,
            idFactory,
            enumMap,
        });
    }
    throw new Error("Unknown node kind");
};

const SUPPORTED_EXAMPLE_DIRECTIVES = [
    "exampleID",
    "exampleString",
    "exampleInt",
    "exampleFloat",
    "exampleBoolean",
    // array
    "exampleArrayID",
    "exampleArrayString",
    "exampleArrayInt",
    "exampleArrayFloat",
    "exampleArrayBoolean",
];
const isIdType = (node: NonNullTypeNode | NamedTypeNode | ListTypeNode): boolean => {
    if (node.kind === "NonNullType") {
        return isIdType(node.type);
    }
    if (node.kind === "NamedType") {
        return node.name.value === "ID";
    }
    if (node.kind === "ListType") {
        return false;
    }
    return false;
};

function parseFieldOrInputValueDefinition({
    node,
    convertedTypeName,
    config,
    idFactory,
    enumMap,
}: {
    node: FieldDefinitionNode | InputValueDefinitionNode;
    convertedTypeName: string;
    config: Config;
    idFactory: ReturnType<typeof createIDFactory>;
    enumMap: EnumMap;
}): { comment?: string | undefined; example?: ExampleDirective | undefined } {
    const fieldName = node.name.value;
    const comment = node.description ? transformComment(node.description) : undefined;
    const exampleDirective = node.directives?.find((d) => {
        return SUPPORTED_EXAMPLE_DIRECTIVES.includes(d.name.value);
    });
    // @example* directive is not found, return random value for the scalar type
    if (!exampleDirective) {
        return {
            comment,
            example: nodeToExpression({
                convertedTypeName,
                fieldName,
                currentNode: node.type,
                config,
                idFactory,
                enumMap,
            }),
        };
    }
    if (!exampleDirective.arguments) {
        throw new Error(
            `@${exampleDirective.name.value} directive must have arguments. @${exampleDirective.name.value}(value: ...)`,
        );
    }
    // [String!]! -> true
    // [String!] -> true
    // String -> false
    const isListTypeNode = (node: TypeNode): node is ListTypeNode | NonNullTypeNode => {
        if (node.kind === "ListType") {
            return true;
        }
        if (node.kind === "NonNullType") {
            return isListTypeNode(node.type);
        }
        return false;
    };
    if (isListTypeNode(node.type)) {
        /**
         * @exampleArrayID(values: ["id1", "id2"])
         * -> { values: ["id1", "id2"] }
         * @exampleArrayString(values: ["value 1", "value 2"])
         * -> { values: ["value 1", "value 2"] }
         * @exampleArrayInt(values: [1, 2])
         * -> { values: [1, 2] }
         * @exampleArrayFloat(values: [1.1, 2.2])
         * -> { values: [1.1, 2.2] }
         * @exampleArrayBoolean(values: [true, false])
         * -> { values: [true, false] }
         */
        const exampleDirectiveValues = exampleDirective.arguments.find(
            (a) => a.name.value === "values",
        );
        if (!exampleDirectiveValues) {
            throw new Error(
                `@${exampleDirective.name.value} directive must have values argument. @${exampleDirective.name.value}(values: ...)`,
            );
        }
        if (exampleDirectiveValues.value.kind !== "ListValue") {
            throw new Error(
                `@${exampleDirective.name.value} directive must have values argument. @${exampleDirective.name.value}(values: ...). values is not array.`,
            );
        }
        // [String!]! -> String
        // [String!] -> String
        const unwrapListNodeType = (node: ListTypeNode | NonNullTypeNode | TypeNode): TypeNode => {
            if (node.kind === "ListType") {
                return unwrapListNodeType(node.type);
            }
            if (node.kind === "NonNullType") {
                return unwrapListNodeType(node.type);
            }
            return node;
        };
        const itemOfArrayNodeType = unwrapListNodeType(node.type);
        const itemOfArrayRawValueType = parseTypeNodeStructure(itemOfArrayNodeType);
        const exampleDirectiveRawValues = exampleDirectiveValues.value.values.map((v) => {
            return valueOfNode(v);
        }) as ValuePrimitive[]; // TODO: need to fix type
        // all raw values should be the same type
        const exampleDirectiveRawValueTypeSet = new Set<string>([
            ...exampleDirectiveRawValues.map((value) => {
                // array, object, string, number, boolean, null
                return Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
            }),
        ]);
        if (exampleDirectiveRawValueTypeSet.size !== 1) {
            throw new Error(
                `${convertedTypeName}.${fieldName}: @${
                    exampleDirective.name.value
                } directive values must be the same type. Got [${exampleDirectiveRawValues.join(
                    ", ",
                )}]`,
            );
        }
        // pick one of the raw value type
        const oneOfExampleDirectiveRawValueType = exampleDirectiveRawValueTypeSet
            .values()
            .next().value;
        if (itemOfArrayRawValueType !== oneOfExampleDirectiveRawValueType) {
            throw new Error(
                `${convertedTypeName}.${fieldName}: @${exampleDirective.name.value} directive values type must be ${itemOfArrayRawValueType}. Got ${oneOfExampleDirectiveRawValueType}`,
            );
        }
        // if ID type, add idFactory() to the value
        // e.g. @exampleArrayID(values: ["id1", "id2"]) -> { expression: [__id("id1"), __id("id2")] }
        const isExampleArrayIdDirective = exampleDirective.name.value === "exampleArrayID";
        if (isExampleArrayIdDirective) {
            const expressions = exampleDirectiveRawValues.flatMap((rawValue) => {
                if (typeof rawValue !== "string") {
                    return [];
                }
                return idFactory(rawValue, `${convertedTypeName}.${fieldName}.${rawValue}`);
            });
            return { comment, example: { expression: `[${expressions.join(",")}]` } };
        }
        return { comment, example: { value: exampleDirectiveRawValues } };
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
    const exampleDirectiveValue = exampleDirective.arguments.find((a) => a.name.value === "value");
    if (!exampleDirectiveValue) {
        throw new Error(
            `@${exampleDirective.name.value} directive must have value argument. @${exampleDirective.name.value}(value: ...)`,
        );
    }
    const exampleDirectiveRawValue = valueOfNode(exampleDirectiveValue.value);
    // if node type is not equal to the value type, throw an error
    const nodeType = parseTypeNodeStructure(node.type);
    // array, object, string, number, boolean, null
    const directiveRawValueType = Object.prototype.toString
        .call(exampleDirectiveRawValue)
        .slice(8, -1)
        .toLowerCase();
    if (nodeType !== directiveRawValueType) {
        throw new Error(
            `${convertedTypeName}.${fieldName}: @${exampleDirective.name.value} directive value type must be ${nodeType}. Got ${directiveRawValueType}`,
        );
    }
    // if ID type, add idFactory() to the value
    // e.g. @exampleID(value: "id") -> { expression: __id("id") }
    const isExampleIdDirective = exampleDirective.name.value === "exampleID";
    if (isExampleIdDirective && typeof exampleDirectiveRawValue === "string") {
        const pathOfField = `${convertedTypeName}.${fieldName}.${exampleDirectiveRawValue}`;
        return {
            comment,
            example: { expression: idFactory(exampleDirectiveRawValue, pathOfField) },
        };
    }
    return { comment, example: { value: exampleDirectiveRawValue } };
}

function parseObjectTypeOrInputObjectTypeDefinition({
    node,
    config,
    idFactory,
    enumMap,
}: {
    node: ObjectTypeDefinitionNode | InputObjectTypeDefinitionNode;
    config: Config;
    idFactory: ReturnType<typeof createIDFactory>;
    enumMap: EnumMap;
}): ObjectTypeInfo {
    const originalTypeName = node.name.value;
    const convertedTypeName = convertName(originalTypeName, config);
    return {
        type: "object",
        name: originalTypeName,
        fields: [
            ...(node.fields ?? []).map((field) => ({
                name: field.name.value,
                ...parseFieldOrInputValueDefinition({
                    node: field,
                    convertedTypeName,
                    config,
                    idFactory,
                    enumMap,
                }),
            })),
        ],
    };
}

type FieldInfo = {
    name: string;
    example?: ExampleDirective | undefined;
};
export type ObjectTypeInfo = {
    type: "object";
    name: string;
    fields: FieldInfo[];
};
export type EnumTypeInfo = {
    type: "enum";
    name: string;
    fields: FieldInfo[];
};
export type InterfaceTypeInfo = {
    type: "interface";
    name: string;
    possibleTypes: string[];
    comment?: string | undefined;
    example?: ExampleDirective | undefined;
};
export type UnionTypeInfo = {
    type: "union";
    name: string;
    possibleTypes: string[];
    example?: ExampleDirective | undefined;
};
export type TypeInfo = ObjectTypeInfo | InterfaceTypeInfo | EnumTypeInfo | UnionTypeInfo;
export type EnumMap = Map<string, TypeInfo>;
const createObjectTypeInfo = ({
    config,
    schema,
    enumMap,
}: {
    config: Config;
    schema: GraphQLSchema;
    enumMap: EnumMap;
}): TypeInfo[] => {
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
    const objectTypeDefinitions = userDefinedTypeDefinitions.filter(
        (node): node is ObjectTypeDefinitionNode => {
            if (!node) return false;
            return node.kind === Kind.OBJECT_TYPE_DEFINITION;
        },
    );

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
            if (
                node?.kind === Kind.OBJECT_TYPE_DEFINITION ||
                node?.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION
            ) {
                return parseObjectTypeOrInputObjectTypeDefinition({
                    node,
                    config,
                    idFactory,
                    enumMap,
                }) satisfies ObjectTypeInfo;
            }
            if (node?.kind === Kind.INTERFACE_TYPE_DEFINITION) {
                return {
                    type: "interface",
                    name: convertName(node.name.value, config),
                    possibleTypes: objectTypeDefinitions
                        .filter((objectTypeDefinitionNode) =>
                            (objectTypeDefinitionNode.interfaces ?? []).some(
                                (i) => i.name.value === node.name.value,
                            ),
                        )
                        .map((objectTypeDefinitionNode) =>
                            convertName(objectTypeDefinitionNode.name.value, config),
                        ),
                } satisfies InterfaceTypeInfo;
            }
            if (node?.kind === Kind.UNION_TYPE_DEFINITION) {
                return {
                    type: "union",
                    name: convertName(node.name.value, config),
                    possibleTypes: (node.types ?? []).map((type) =>
                        convertName(type.name.value, config),
                    ),
                } satisfies UnionTypeInfo;
            }
            throw new Error(`Unknown kind of node: ${node}`);
        });
};

const createEnumTypeInfo = ({
    config,
    schema,
}: {
    config: Config;
    schema: GraphQLSchema;
}): TypeInfo[] => {
    // GraphQL AST does not represent enum values
    // https://astexplorer.net/#/gist/bbfe3f7414a904b453e173d82e836525/bab0cc96ffb951909dc3cf67a67bd67d09948be6
    // Therefore, We need to create "object" type from EnumTypeDefinitionNode
    // enum Color { RED, GREEN, BLUE }
    // -> const Color = { RED: "RED", GREEN: "GREEN", BLUE: "BLUE" }
    const types = Object.values(schema.getTypeMap());
    const userDefinedEnumTypeDefinitions = types
        .map((type) => type.astNode)
        .filter((node): node is EnumTypeDefinitionNode => {
            if (!node) return false;
            return node.kind === Kind.ENUM_TYPE_DEFINITION;
        });
    return userDefinedEnumTypeDefinitions.map((node) => {
        return {
            type: "enum",
            name: convertName(node.name.value, config),
            fields:
                node?.values?.map((value) => {
                    return {
                        name: value.name.value,
                        example: {
                            value: value.name.value,
                        },
                    };
                }) ?? [],
        };
    });
};

export function getTypeInfos(config: Config, schema: GraphQLSchema): TypeInfo[] {
    const enumTypeInfo = createEnumTypeInfo({ config: config, schema: schema });
    const enumMap = new Map(enumTypeInfo.map((info) => [info.name, info]));
    return [...enumTypeInfo, ...createObjectTypeInfo({ config: config, schema: schema, enumMap })];
}
