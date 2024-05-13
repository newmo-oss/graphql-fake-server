import exp from "node:constants";
// NOTE: To avoid `Cannot use GraphQLSchema xxx from another module or realm.`, import from 'graphql/index.js' instead of 'graphql'.
// ref: https://github.com/graphql/graphql-js/issues/1479
import { convertFactory } from "@graphql-codegen/visitor-plugin-common";
import { buildSchema as buildSchemaGraphQL } from "graphql";
import type { GraphQLSchema } from "graphql/index.js";
import { describe, expect, it } from "vitest";
import type { Config } from "./config.js";
import { extendSchema } from "./extend-schema.js";
import { type ObjectTypeInfo, type TypeInfo, getTypeInfos } from "./schema-scanner.js";

/**
 * export type Config = {
 *     typesFile: string;
 *     skipTypename: Exclude<RawTypesConfig['skipTypename'], undefined>;
 *     typesPrefix: Exclude<RawTypesConfig['typesPrefix'], undefined>;
 *     typesSuffix: Exclude<RawTypesConfig['typesSuffix'], undefined>;
 *     namingConvention: Exclude<RawTypesConfig['namingConvention'], undefined>;
 *     maxFieldRecursionDepth: number;
 *     defaultValues: {
 *         String: string
 *         Int: number
 *         Float: number
 *         Boolean: boolean
 *         ID: string,
 *         listLength: number
 *     }
 * };
 * @param config
 */
const fakeConfig = (config?: Partial<Config>): Config => {
    return {
        typesFile: "types.ts",
        skipTypename: true,
        typesPrefix: "",
        typesSuffix: "",
        namingConvention: "keep",
        maxFieldRecursionDepth: 1,
        defaultValues: {
            String: "xxxx",
            Int: 0,
            Float: 0,
            Boolean: false,
            ID: "xxxx-xxxx-xxxx-xxxx",
            listLength: 3,
        },
        ...config,
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
                    "expression": "__id({ name: "xxxx-xxxx-xxxx-xxxx", key:"Book.id", depth })",
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
                    "expression": "(depth < 1 ? createAuthor({ defaultFields: defaultFields?.author ?? {}, depth: depth + 1 }) : undefined)",
                  },
                  "name": "author",
                },
              ],
              "name": "Book",
              "type": "object",
            },
            {
              "fields": [
                {
                  "comment": undefined,
                  "example": {
                    "expression": "__id({ name: "id", key:"Author.id.id", depth })",
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
                    "expression": "(depth < 1) ? Array.from({ length: 3 }).map(() => (depth < 1 ? createBook({ defaultFields: defaultFields?.books ?? {}, depth: depth + 1 }) : undefined)) : []",
                  },
                  "name": "books",
                },
              ],
              "name": "Author",
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
                    "expression": "__id({ name: "xxxx-xxxx-xxxx-xxxx", key:"Book.id", depth })",
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
                      "expression": "(depth < 1) ? Array.from({ length: 3 }).map(() => "xxxx") : []",
                    },
                    "name": "field2",
                  },
                  {
                    "comment": undefined,
                    "example": {
                      "expression": "(depth < 1 ? createSubType({ defaultFields: defaultFields?.field3 ?? {}, depth: depth + 1 }) : undefined)",
                    },
                    "name": "field3",
                  },
                  {
                    "comment": undefined,
                    "example": {
                      "expression": "(depth < 1) ? Array.from({ length: 3 }).map(() => (depth < 1 ? createSubType({ defaultFields: defaultFields?.field4 ?? {}, depth: depth + 1 }) : undefined)) : []",
                    },
                    "name": "field4",
                  },
                ],
                "name": "Type",
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
                  "possibleTypes": [
                    "ImplementingType",
                  ],
                  "type": "interface",
                },
                {
                  "name": "Interface2",
                  "possibleTypes": [
                    "ImplementingType",
                  ],
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
                  "possibleTypes": [
                    "Member1",
                    "Member2",
                  ],
                  "type": "union",
                },
                {
                  "name": "Union2",
                  "possibleTypes": [
                    "Member1",
                    "Member2",
                  ],
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
                      "expression": "(depth < 1 ? createSubType({ defaultFields: defaultFields?.field2 ?? {}, depth: depth + 1 }) : undefined)",
                    },
                    "name": "field2",
                  },
                ],
                "name": "Input",
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
                        "expression": "__id({ name: "xxxx-xxxx-xxxx-xxxx", key:"User.id", depth })",
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
                        "expression": "(depth < 1 ? createUser({ defaultFields: defaultFields?.blockedByUser ?? {}, depth: depth + 1 }) : undefined)",
                      },
                      "name": "blockedByUser",
                    },
                  ],
                  "name": "IsBlocked",
                  "type": "object",
                },
                {
                  "name": "UserResult",
                  "possibleTypes": [
                    "User",
                    "IsBlocked",
                    "Suspended",
                  ],
                  "type": "union",
                },
                {
                  "fields": [
                    {
                      "comment": undefined,
                      "example": {
                        "expression": "(depth < 1 ? createUserResult({ defaultFields: defaultFields?.user ?? {}, depth: depth + 1 }) : undefined)",
                      },
                      "name": "user",
                    },
                  ],
                  "name": "Query",
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
                            "expression": "(depth < 1 ? createSubType({ defaultFields: defaultFields?.field2 ?? {}, depth: depth + 1 }) : undefined)",
                          },
                          "name": "field2",
                        },
                      ],
                      "name": "Type",
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
                      "name": "SubType",
                      "type": "object",
                    },
                    {
                      "name": "IInterface",
                      "possibleTypes": [
                        "IType",
                      ],
                      "type": "interface",
                    },
                    {
                      "name": "IUnion",
                      "possibleTypes": [
                        "IType",
                      ],
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
                            "expression": "(depth < 1 ? createSubType({ defaultFields: defaultFields?.field2 ?? {}, depth: depth + 1 }) : undefined)",
                          },
                          "name": "field2",
                        },
                      ],
                      "name": "Type",
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
                      "name": "SubType",
                      "type": "object",
                    },
                    {
                      "name": "InterfaceI",
                      "possibleTypes": [
                        "TypeI",
                      ],
                      "type": "interface",
                    },
                    {
                      "name": "UnionI",
                      "possibleTypes": [
                        "TypeI",
                      ],
                      "type": "union",
                    },
                  ]
                `);
            });
        });
    });
});
