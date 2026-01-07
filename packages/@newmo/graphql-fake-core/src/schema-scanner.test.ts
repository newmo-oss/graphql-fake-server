import { buildSchema as buildSchemaGraphQL } from "graphql";
import type { GraphQLSchema } from "graphql/index.js";
import { describe, expect, it } from "vitest";
import type { Config } from "./config.js";
import { extendSchema } from "./extend-schema.js";
import { getTypeInfos, type ObjectTypeInfo, type TypeInfo } from "./schema-scanner.js";

const fakeConfig = (config?: Partial<Config>): Config => {
    return {
        typesFile: "types.ts",
        skipTypename: config?.skipTypename ?? true,
        typesPrefix: config?.typesPrefix ?? "",
        typesSuffix: config?.typesSuffix ?? "",
        namingConvention: config?.namingConvention ?? "keep",
        mock: {
            maxDepth: config?.mock?.maxDepth ?? 9,
            maxTypeRecursion: config?.mock?.maxTypeRecursion ?? 2,
            listLength: config?.mock?.listLength ?? 3,
            defaultValues: {
                String: config?.mock?.defaultValues?.String ?? "xxxx",
                Int: config?.mock?.defaultValues?.Int ?? 0,
                Float: config?.mock?.defaultValues?.Float ?? 0,
                Boolean: config?.mock?.defaultValues?.Boolean ?? false,
                ID: config?.mock?.defaultValues?.ID ?? "xxxx-xxxx-xxxx-xxxx",
                CustomScalar: config?.mock?.defaultValues?.CustomScalar ?? {},
            },
        },
    };
};

function isObjectTypeInfo(x: TypeInfo): x is ObjectTypeInfo {
    return x.type === "object";
}

const buildSchema = (schema: string): GraphQLSchema => {
    return buildSchemaGraphQL(extendSchema(schema));
};
describe("getTypeInfos", () => {
    it("returns typename and field names", () => {
        const schema = buildSchema(`
      type Book {
        id: ID!
        title: String! @exampleString(value: "title")
        author: Author!
      }
      type Author {
        id: ID! @exampleID(value: "id")
        name: String! @exampleString(value: "name")
        " comment "
        books: [Book!]!
      }
    `);
        const config: Config = fakeConfig();
        expect(getTypeInfos(config, schema)).toMatchInlineSnapshot(`
          [
            {
              "fields": [
                {
                  "comment": undefined,
                  "example": {
                    "expression": "__id({ name: "xxxx-xxxx-xxxx-xxxx", key:"Book.id" })",
                  },
                  "name": "id",
                },
                {
                  "comment": undefined,
                  "example": {
                    "value": "title",
                  },
                  "name": "title",
                },
                {
                  "comment": undefined,
                  "example": {
                    "expression": "(depth < 9 && (typeVisitCount["Author"] ?? 0) < 2 ? createAuthor({ defaultFields: defaultFields?.author ?? {}, depth: depth + 1, typeVisitCount: { ...typeVisitCount, "Author": (typeVisitCount["Author"] ?? 0) + 1 } }) : undefined)",
                  },
                  "name": "author",
                },
              ],
              "name": "Book",
              "rawName": "Book",
              "type": "object",
            },
            {
              "fields": [
                {
                  "comment": undefined,
                  "example": {
                    "expression": "__id({ name: "id", key:"Author.id.id" })",
                  },
                  "name": "id",
                },
                {
                  "comment": undefined,
                  "example": {
                    "value": "name",
                  },
                  "name": "name",
                },
                {
                  "comment": "/**  comment  */
          ",
                  "example": {
                    "expression": "(depth < 9 && (typeVisitCount["Book"] ?? 0) < 2 ? Array.from({ length: 3 }).map(() => (depth < 9 && (typeVisitCount["Book"] ?? 0) < 2 ? createBook({ defaultFields: defaultFields?.books ?? {}, depth: depth + 1, typeVisitCount: { ...typeVisitCount, "Book": (typeVisitCount["Book"] ?? 0) + 1 } }) : undefined)).filter(Boolean) : [])",
                  },
                  "name": "books",
                },
              ],
              "name": "Author",
              "rawName": "Author",
              "type": "object",
            },
          ]
        `);
    });
    it("should support enum types", () => {
        const schema = buildSchema(`
enum DocumentType {
    LICENSE
    TICKET
}

type RequiredDocument {
  name: String!
  type: DocumentType!
}
`);
        const config: Config = fakeConfig();
        expect(getTypeInfos(config, schema)).toMatchInlineSnapshot(`
          [
            {
              "fields": [
                {
                  "example": {
                    "value": "LICENSE",
                  },
                  "name": "LICENSE",
                },
                {
                  "example": {
                    "value": "TICKET",
                  },
                  "name": "TICKET",
                },
              ],
              "name": "DocumentType",
              "rawName": "DocumentType",
              "type": "enum",
            },
            {
              "fields": [
                {
                  "comment": undefined,
                  "example": {
                    "expression": ""xxxx"",
                  },
                  "name": "name",
                },
                {
                  "comment": undefined,
                  "example": {
                    "expression": "Object.values(DocumentType)[0]",
                  },
                  "name": "type",
                },
              ],
              "name": "RequiredDocument",
              "rawName": "RequiredDocument",
              "type": "object",
            },
          ]
        `);
    });
    it("includes description comment", () => {
        const schema = buildSchema(`
      "The book"
      type Book {
        id: ID!
        "The book title"
        title: String!
      }
    `);
        const config: Config = fakeConfig();
        expect(getTypeInfos(config, schema)).toMatchInlineSnapshot(`
          [
            {
              "fields": [
                {
                  "comment": undefined,
                  "example": {
                    "expression": "__id({ name: "xxxx-xxxx-xxxx-xxxx", key:"Book.id" })",
                  },
                  "name": "id",
                },
                {
                  "comment": "/** The book title */
          ",
                  "example": {
                    "expression": ""xxxx"",
                  },
                  "name": "title",
                },
              ],
              "name": "Book",
              "rawName": "Book",
              "type": "object",
            },
          ]
        `);
    });
    it("argument", () => {
        const schema = buildSchema(`
      type Argument {
        field(arg: String!): String!
      }
    `);
        const config: Config = fakeConfig();
        expect(getTypeInfos(config, schema)[0]).toMatchInlineSnapshot(`
          {
            "fields": [
              {
                "comment": undefined,
                "example": {
                  "expression": ""xxxx"",
                },
                "name": "field",
              },
            ],
            "name": "Argument",
            "rawName": "Argument",
            "type": "object",
          }
        `);
    });
    describe("GraphQL features test", () => {
        it("nullable", () => {
            const schema = buildSchema(`
        type Type {
          field1: String
          field2: [String]
          field3: SubType
          field4: [SubType]
        }
        type SubType {
          field: String!
        }
      `);
            const config: Config = fakeConfig();
            expect(getTypeInfos(config, schema)[0]).toMatchInlineSnapshot(`
              {
                "fields": [
                  {
                    "comment": undefined,
                    "example": {
                      "expression": ""xxxx"",
                    },
                    "name": "field1",
                  },
                  {
                    "comment": undefined,
                    "example": {
                      "expression": "Array.from({ length: 3 }).map(() => "xxxx")",
                    },
                    "name": "field2",
                  },
                  {
                    "comment": undefined,
                    "example": {
                      "expression": "(depth < 9 && (typeVisitCount["SubType"] ?? 0) < 2 ? createSubType({ defaultFields: defaultFields?.field3 ?? {}, depth: depth + 1, typeVisitCount: { ...typeVisitCount, "SubType": (typeVisitCount["SubType"] ?? 0) + 1 } }) : undefined)",
                    },
                    "name": "field3",
                  },
                  {
                    "comment": undefined,
                    "example": {
                      "expression": "(depth < 9 && (typeVisitCount["SubType"] ?? 0) < 2 ? Array.from({ length: 3 }).map(() => (depth < 9 && (typeVisitCount["SubType"] ?? 0) < 2 ? createSubType({ defaultFields: defaultFields?.field4 ?? {}, depth: depth + 1, typeVisitCount: { ...typeVisitCount, "SubType": (typeVisitCount["SubType"] ?? 0) + 1 } }) : undefined)).filter(Boolean) : [])",
                    },
                    "name": "field4",
                  },
                ],
                "name": "Type",
                "rawName": "Type",
                "type": "object",
              }
            `);
        });
        it("interface", () => {
            const schema = buildSchema(`
        interface Interface1 {
          fieldA: String!
        }
        interface Interface2 {
          fieldB: String!
        }
        type ImplementingType implements Interface1 & Interface2 {
          fieldA: String!
          fieldB: String!
        }
      `);
            expect(getTypeInfos(fakeConfig({}), schema)).toMatchInlineSnapshot(`
              [
                {
                  "name": "Interface1",
                  "possibleRawTypeNames": [
                    "ImplementingType",
                  ],
                  "rawName": "Interface1",
                  "type": "interface",
                },
                {
                  "name": "Interface2",
                  "possibleRawTypeNames": [
                    "ImplementingType",
                  ],
                  "rawName": "Interface2",
                  "type": "interface",
                },
                {
                  "fields": [
                    {
                      "comment": undefined,
                      "example": {
                        "expression": ""xxxx"",
                      },
                      "name": "fieldA",
                    },
                    {
                      "comment": undefined,
                      "example": {
                        "expression": ""xxxx"",
                      },
                      "name": "fieldB",
                    },
                  ],
                  "name": "ImplementingType",
                  "rawName": "ImplementingType",
                  "type": "object",
                },
              ]
            `);
        });
        it("union", () => {
            const schema = buildSchema(`
        union Union1 = Member1 | Member2
        union Union2 = Member1 | Member2
        type Member1 {
          field1: String!
        }
        type Member2 {
          field2: String!
        }
      `);
            expect(getTypeInfos(fakeConfig({}), schema)).toMatchInlineSnapshot(`
              [
                {
                  "name": "Union1",
                  "possibleRawTypeNames": [
                    "Member1",
                    "Member2",
                  ],
                  "rawName": "Union1",
                  "type": "union",
                },
                {
                  "name": "Union2",
                  "possibleRawTypeNames": [
                    "Member1",
                    "Member2",
                  ],
                  "rawName": "Union2",
                  "type": "union",
                },
                {
                  "fields": [
                    {
                      "comment": undefined,
                      "example": {
                        "expression": ""xxxx"",
                      },
                      "name": "field1",
                    },
                  ],
                  "name": "Member1",
                  "rawName": "Member1",
                  "type": "object",
                },
                {
                  "fields": [
                    {
                      "comment": undefined,
                      "example": {
                        "expression": ""xxxx"",
                      },
                      "name": "field2",
                    },
                  ],
                  "name": "Member2",
                  "rawName": "Member2",
                  "type": "object",
                },
              ]
            `);
        });
        it("should support input type", () => {
            const schema = buildSchema(`
        input Input {
          field1: String!
          field2: SubType!
        }
        type SubType {
          field: String!
        }
      `);
            const config: Config = fakeConfig();
            expect(getTypeInfos(config, schema)[0]).toMatchInlineSnapshot(`
              {
                "fields": [
                  {
                    "comment": undefined,
                    "example": {
                      "expression": ""xxxx"",
                    },
                    "name": "field1",
                  },
                  {
                    "comment": undefined,
                    "example": {
                      "expression": "(depth < 9 && (typeVisitCount["SubType"] ?? 0) < 2 ? createSubType({ defaultFields: defaultFields?.field2 ?? {}, depth: depth + 1, typeVisitCount: { ...typeVisitCount, "SubType": (typeVisitCount["SubType"] ?? 0) + 1 } }) : undefined)",
                    },
                    "name": "field2",
                  },
                ],
                "name": "Input",
                "rawName": "Input",
                "type": "object",
              }
            `);
        });
        it("should support union", () => {
            const schema = buildSchema(`
        type User {
          id: ID!
          name: String
        }
        type Suspended {
          reason: String
        }
        type IsBlocked {
          message: String
          blockedByUser: User
        }
        union UserResult = User | IsBlocked | Suspended
        type Query {
            user: UserResult
        }
    `);
            expect(getTypeInfos(fakeConfig({}), schema)).toMatchInlineSnapshot(`
              [
                {
                  "fields": [
                    {
                      "comment": undefined,
                      "example": {
                        "expression": "__id({ name: "xxxx-xxxx-xxxx-xxxx", key:"User.id" })",
                      },
                      "name": "id",
                    },
                    {
                      "comment": undefined,
                      "example": {
                        "expression": ""xxxx"",
                      },
                      "name": "name",
                    },
                  ],
                  "name": "User",
                  "rawName": "User",
                  "type": "object",
                },
                {
                  "fields": [
                    {
                      "comment": undefined,
                      "example": {
                        "expression": ""xxxx"",
                      },
                      "name": "reason",
                    },
                  ],
                  "name": "Suspended",
                  "rawName": "Suspended",
                  "type": "object",
                },
                {
                  "fields": [
                    {
                      "comment": undefined,
                      "example": {
                        "expression": ""xxxx"",
                      },
                      "name": "message",
                    },
                    {
                      "comment": undefined,
                      "example": {
                        "expression": "(depth < 9 && (typeVisitCount["User"] ?? 0) < 2 ? createUser({ defaultFields: defaultFields?.blockedByUser ?? {}, depth: depth + 1, typeVisitCount: { ...typeVisitCount, "User": (typeVisitCount["User"] ?? 0) + 1 } }) : undefined)",
                      },
                      "name": "blockedByUser",
                    },
                  ],
                  "name": "IsBlocked",
                  "rawName": "IsBlocked",
                  "type": "object",
                },
                {
                  "name": "UserResult",
                  "possibleRawTypeNames": [
                    "User",
                    "IsBlocked",
                    "Suspended",
                  ],
                  "rawName": "UserResult",
                  "type": "union",
                },
                {
                  "fields": [
                    {
                      "comment": undefined,
                      "example": {
                        "expression": "(depth < 9 && (typeVisitCount["UserResult"] ?? 0) < 2 ? createUserResult({ defaultFields: defaultFields?.user ?? {}, depth: depth + 1, typeVisitCount: { ...typeVisitCount, "UserResult": (typeVisitCount["UserResult"] ?? 0) + 1 } }) : undefined)",
                      },
                      "name": "user",
                    },
                  ],
                  "name": "Query",
                  "rawName": "Query",
                  "type": "object",
                },
              ]
            `);
        });
        it("support custom scalar", () => {
            const schema = buildSchema(`
            scalar Date
            type Type {
              field: Date!
            }
          `);
            const config: Config = fakeConfig({
                mock: {
                    defaultValues: {
                        CustomScalar: {
                            Date: "new Date()",
                        },
                    },
                },
            });
            expect(getTypeInfos(config, schema)).toMatchInlineSnapshot(`
              [
                {
                  "example": undefined,
                  "name": "Date",
                  "rawName": "Date",
                  "type": "scalar",
                },
                {
                  "fields": [
                    {
                      "comment": undefined,
                      "example": {
                        "expression": "new Date()",
                      },
                      "name": "field",
                    },
                  ],
                  "name": "Type",
                  "rawName": "Type",
                  "type": "object",
                },
              ]
            `);
        });
        it("support custom scalar with directive", () => {
            const schema = buildSchema(`
            scalar Date @exampleScalarString(value: "2024-06-25T14:52:42.074Z")
            type Type {
              field: Date!
            }
          `);
            const config: Config = fakeConfig();
            expect(getTypeInfos(config, schema)).toMatchInlineSnapshot(`
              [
                {
                  "example": {
                    "value": "2024-06-25T14:52:42.074Z",
                  },
                  "name": "Date",
                  "rawName": "Date",
                  "type": "scalar",
                },
                {
                  "fields": [
                    {
                      "comment": undefined,
                      "example": {
                        "expression": ""2024-06-25T14:52:42.074Z"",
                      },
                      "name": "field",
                    },
                  ],
                  "name": "Type",
                  "rawName": "Type",
                  "type": "object",
                },
              ]
            `);
        });
    });
    describe("options", () => {
        describe("skipTypename", () => {
            it("includes __typename if skipTypename is false", () => {
                const schema = buildSchema(`
          type Type {
            field: String!
          }
        `);
                const config: Config = fakeConfig({ skipTypename: false });
                expect(
                    getTypeInfos(config, schema).find(isObjectTypeInfo)?.fields,
                ).toMatchInlineSnapshot(`
                  [
                    {
                      "comment": undefined,
                      "example": {
                        "expression": ""xxxx"",
                      },
                      "name": "field",
                    },
                  ]
                `);
            });
            it("does not include __typename if skipTypename is true", () => {
                const schema = buildSchema(`
          type Type {
            field: String!
          }
        `);
                const config: Config = fakeConfig({ skipTypename: true });
                expect(
                    getTypeInfos(config, schema).find(isObjectTypeInfo)?.fields,
                ).toMatchInlineSnapshot(`
                  [
                    {
                      "comment": undefined,
                      "example": {
                        "expression": ""xxxx"",
                      },
                      "name": "field",
                    },
                  ]
                `);
            });
        });
        describe("typesPrefix", () => {
            it("renames type by typesPrefix", () => {
                const schema = buildSchema(`
          type Type implements Interface {
            field1: String!
            field2: SubType!
          }
          type SubType {
            field: String!
          }
          interface Interface {
            field1: String!
          }
          union Union = Type
        `);
                const config: Config = fakeConfig({ typesPrefix: "I" });
                expect(getTypeInfos(config, schema)).toMatchInlineSnapshot(`
                  [
                    {
                      "fields": [
                        {
                          "comment": undefined,
                          "example": {
                            "expression": ""xxxx"",
                          },
                          "name": "field1",
                        },
                        {
                          "comment": undefined,
                          "example": {
                            "expression": "(depth < 9 && (typeVisitCount["SubType"] ?? 0) < 2 ? createSubType({ defaultFields: defaultFields?.field2 ?? {}, depth: depth + 1, typeVisitCount: { ...typeVisitCount, "SubType": (typeVisitCount["SubType"] ?? 0) + 1 } }) : undefined)",
                          },
                          "name": "field2",
                        },
                      ],
                      "name": "IType",
                      "rawName": "Type",
                      "type": "object",
                    },
                    {
                      "fields": [
                        {
                          "comment": undefined,
                          "example": {
                            "expression": ""xxxx"",
                          },
                          "name": "field",
                        },
                      ],
                      "name": "ISubType",
                      "rawName": "SubType",
                      "type": "object",
                    },
                    {
                      "name": "IInterface",
                      "possibleRawTypeNames": [
                        "Type",
                      ],
                      "rawName": "Interface",
                      "type": "interface",
                    },
                    {
                      "name": "IUnion",
                      "possibleRawTypeNames": [
                        "Type",
                      ],
                      "rawName": "Union",
                      "type": "union",
                    },
                  ]
                `);
            });
        });
        describe("typesSuffix", () => {
            it("renames type by typesSuffix", () => {
                const schema = buildSchema(`
          type Type implements Interface {
            field1: String!
            field2: SubType!
          }
          type SubType {
            field: String!
          }
          interface Interface {
            field1: String!
          }
          union Union = Type
        `);
                const config: Config = fakeConfig({ typesSuffix: "I" });
                expect(getTypeInfos(config, schema)).toMatchInlineSnapshot(`
                  [
                    {
                      "fields": [
                        {
                          "comment": undefined,
                          "example": {
                            "expression": ""xxxx"",
                          },
                          "name": "field1",
                        },
                        {
                          "comment": undefined,
                          "example": {
                            "expression": "(depth < 9 && (typeVisitCount["SubType"] ?? 0) < 2 ? createSubType({ defaultFields: defaultFields?.field2 ?? {}, depth: depth + 1, typeVisitCount: { ...typeVisitCount, "SubType": (typeVisitCount["SubType"] ?? 0) + 1 } }) : undefined)",
                          },
                          "name": "field2",
                        },
                      ],
                      "name": "TypeI",
                      "rawName": "Type",
                      "type": "object",
                    },
                    {
                      "fields": [
                        {
                          "comment": undefined,
                          "example": {
                            "expression": ""xxxx"",
                          },
                          "name": "field",
                        },
                      ],
                      "name": "SubTypeI",
                      "rawName": "SubType",
                      "type": "object",
                    },
                    {
                      "name": "InterfaceI",
                      "possibleRawTypeNames": [
                        "Type",
                      ],
                      "rawName": "Interface",
                      "type": "interface",
                    },
                    {
                      "name": "UnionI",
                      "possibleRawTypeNames": [
                        "Type",
                      ],
                      "rawName": "Union",
                      "type": "union",
                    },
                  ]
                `);
            });
        });
    });
});
