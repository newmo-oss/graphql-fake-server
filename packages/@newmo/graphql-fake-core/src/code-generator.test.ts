import vm from "node:vm";
import type { GraphQLSchema } from "graphql";
import { buildSchema as buildSchemaGraphQL } from "graphql";
import { describe, expect, it } from "vitest";
import type { ConfigWithOutput } from "./code-generator.js";
import { generateCode } from "./code-generator.js";
import { normalizeConfig, type RawConfig } from "./config.js";
import { extendSchema } from "./extend-schema.js";
import { getTypeInfos } from "./schema-scanner.js";

const buildSchema = (schema: string): GraphQLSchema => {
    return buildSchemaGraphQL(extendSchema(schema));
};
const generateCodeFromSchema = ({
    schema,
    outputType,
    rawConfig = {},
}: {
    schema: string;
    outputType?: ConfigWithOutput["outputType"];
    rawConfig?: RawConfig;
}) => {
    const config = normalizeConfig(rawConfig);
    const graphQLSchema = buildSchema(schema);
    const typeInfos = getTypeInfos(config, graphQLSchema);
    return generateCode(
        {
            ...config,
            typesFile: "./type.ts",
            outputType: outputType ?? "javascript",
        },
        typeInfos,
    ).trim();
};
describe("generateCode", () => {
    describe("non-example directive", () => {
        it("generates code for a simple Query type", () => {
            expect(
                generateCodeFromSchema({
                    schema: `
        type Query {
            hello: String
        }
    `,
                }),
            ).toMatchInlineSnapshot(`
              "let __idGlobalId = 0; // global id
              const __idContextCountMap = new Map() // context count
              function __id({ name, key }) {
                  const count = __idContextCountMap.get(key) ?? 0;
                  const id = name + "_g" + String(__idGlobalId) + "_c" + String(count);
                  __idGlobalId += 1;
                  __idContextCountMap.set(key, count + 1);
                  return id;
              }
              export function createQuery({ defaultFields, typeVisitCount = {} } = {}) {
              return {
                  hello: "string",
                };
              }

              export const Query = createQuery();"
            `);
        });

        it("generates code for a Mutation type", () => {
            expect(
                generateCodeFromSchema({
                    schema: `
        type Mutation {
            addMessage(content: String!): Message
        }

        type Message {
            id: ID!
            content: String!
        }
    `,
                }),
            ).toMatchInlineSnapshot(`
              "let __idGlobalId = 0; // global id
              const __idContextCountMap = new Map() // context count
              function __id({ name, key }) {
                  const count = __idContextCountMap.get(key) ?? 0;
                  const id = name + "_g" + String(__idGlobalId) + "_c" + String(count);
                  __idGlobalId += 1;
                  __idContextCountMap.set(key, count + 1);
                  return id;
              }
              export function createMutation({ defaultFields, typeVisitCount = {} } = {}) {
              return {
                  addMessage: ((typeVisitCount["Message"] ?? 0) < 2 ? createMessage({ defaultFields: defaultFields?.addMessage ?? {}, typeVisitCount: { ...typeVisitCount, "Message": (typeVisitCount["Message"] ?? 0) + 1 } }) : undefined),
                };
              }

              export const Mutation = createMutation();
              export function createMessage({ defaultFields, typeVisitCount = {} } = {}) {
              return {
                  id: __id({ name: "xxxx-xxxx-xxxx-xxxx", key:"Message.id" }),
                  content: "string",
                };
              }

              export const Message = createMessage();"
            `);
        });

        it("generates code for a Subscription type", () => {
            expect(
                generateCodeFromSchema({
                    schema: `
        type Subscription {
            messageAdded: Message
        }

        type Message {
            id: ID!
            content: String!
        }
    `,
                }),
            ).toMatchInlineSnapshot(`
              "let __idGlobalId = 0; // global id
              const __idContextCountMap = new Map() // context count
              function __id({ name, key }) {
                  const count = __idContextCountMap.get(key) ?? 0;
                  const id = name + "_g" + String(__idGlobalId) + "_c" + String(count);
                  __idGlobalId += 1;
                  __idContextCountMap.set(key, count + 1);
                  return id;
              }
              export function createSubscription({ defaultFields, typeVisitCount = {} } = {}) {
              return {
                  messageAdded: ((typeVisitCount["Message"] ?? 0) < 2 ? createMessage({ defaultFields: defaultFields?.messageAdded ?? {}, typeVisitCount: { ...typeVisitCount, "Message": (typeVisitCount["Message"] ?? 0) + 1 } }) : undefined),
                };
              }

              export const Subscription = createSubscription();
              export function createMessage({ defaultFields, typeVisitCount = {} } = {}) {
              return {
                  id: __id({ name: "xxxx-xxxx-xxxx-xxxx", key:"Message.id" }),
                  content: "string",
                };
              }

              export const Message = createMessage();"
            `);
        });

        it("generates code for an enum type", () => {
            expect(
                generateCodeFromSchema({
                    schema: `
        enum Status {
            ACTIVE
            INACTIVE
        }

        type User {
            id: ID!
            status: Status!
        }
    `,
                }),
            ).toMatchInlineSnapshot(`
              "let __idGlobalId = 0; // global id
              const __idContextCountMap = new Map() // context count
              function __id({ name, key }) {
                  const count = __idContextCountMap.get(key) ?? 0;
                  const id = name + "_g" + String(__idGlobalId) + "_c" + String(count);
                  __idGlobalId += 1;
                  __idContextCountMap.set(key, count + 1);
                  return id;
              }
              const Status = {
                ACTIVE: "ACTIVE",
                INACTIVE: "INACTIVE",
              };

              export function createUser({ defaultFields, typeVisitCount = {} } = {}) {
              return {
                  id: __id({ name: "xxxx-xxxx-xxxx-xxxx", key:"User.id" }),
                  status: Object.values(Status)[0],
                };
              }

              export const User = createUser();"
            `);
        });

        it("generates code for a Custom Scalar using config", () => {
            expect(
                generateCodeFromSchema({
                    schema: `
        scalar Date
        type Query {
            today: Date
        }
                `,
                    rawConfig: {
                        defaultValues: {
                            CustomScalar: {
                                Date: "new Date().toISOString()",
                            },
                        },
                    },
                }),
            ).toMatchInlineSnapshot(`
              "let __idGlobalId = 0; // global id
              const __idContextCountMap = new Map() // context count
              function __id({ name, key }) {
                  const count = __idContextCountMap.get(key) ?? 0;
                  const id = name + "_g" + String(__idGlobalId) + "_c" + String(count);
                  __idGlobalId += 1;
                  __idContextCountMap.set(key, count + 1);
                  return id;
              }
              export function createQuery({ defaultFields, typeVisitCount = {} } = {}) {
              return {
                  today: new Date().toISOString(),
                };
              }

              export const Query = createQuery();"
            `);
        });
        it("generates code for an interface", () => {
            expect(
                generateCodeFromSchema({
                    schema: `
        interface Animal {
            id: ID!
            name: String!
        }

        type Cat implements Animal {
            id: ID!
            name: String!
            livesLeft: Int
        }

        type Dog implements Animal {
            id: ID!
            name: String!
            breed: String
        }
    `,
                }),
            ).toMatchInlineSnapshot(`
              "let __idGlobalId = 0; // global id
              const __idContextCountMap = new Map() // context count
              function __id({ name, key }) {
                  const count = __idContextCountMap.get(key) ?? 0;
                  const id = name + "_g" + String(__idGlobalId) + "_c" + String(count);
                  __idGlobalId += 1;
                  __idContextCountMap.set(key, count + 1);
                  return id;
              }

              function createAnimal({ defaultFields, typeVisitCount = {} } = {}) {
              return {
                  __typename: "Cat",
                  ...((typeVisitCount["Cat"] ?? 0) < 2 ? createCat({ defaultFields: defaultFields?.Animal ?? {}, typeVisitCount: { ...typeVisitCount, "Cat": (typeVisitCount["Cat"] ?? 0) + 1 } }) : undefined)
              };
              }
              export function createCat({ defaultFields, typeVisitCount = {} } = {}) {
              return {
                  id: __id({ name: "xxxx-xxxx-xxxx-xxxx", key:"Cat.id" }),
                  name: "string",
                  livesLeft: 12,
                };
              }

              export const Cat = createCat();
              export function createDog({ defaultFields, typeVisitCount = {} } = {}) {
              return {
                  id: __id({ name: "xxxx-xxxx-xxxx-xxxx", key:"Dog.id" }),
                  name: "string",
                  breed: "string",
                };
              }

              export const Dog = createDog();"
            `);
        });

        it("generates code for input types", () => {
            expect(
                generateCodeFromSchema({
                    schema: `
        input NewUserInput {
            name: String! @exampleString(value: "John Doe")
            email: String! @exampleString(value: "example@example.com")
        }

        type Mutation {
            createUser(input: NewUserInput!): User
        }

        type User {
            id: ID!
            name: String!
            email: String!
        }
    `,
                }),
            ).toMatchInlineSnapshot(`
              "let __idGlobalId = 0; // global id
              const __idContextCountMap = new Map() // context count
              function __id({ name, key }) {
                  const count = __idContextCountMap.get(key) ?? 0;
                  const id = name + "_g" + String(__idGlobalId) + "_c" + String(count);
                  __idGlobalId += 1;
                  __idContextCountMap.set(key, count + 1);
                  return id;
              }
              export function createNewUserInput({ defaultFields, typeVisitCount = {} } = {}) {
              return {
                  name: "John Doe",
                  email: "example@example.com",
                };
              }

              export const NewUserInput = createNewUserInput();
              export function createMutation({ defaultFields, typeVisitCount = {} } = {}) {
              return {
                  createUser: ((typeVisitCount["User"] ?? 0) < 2 ? createUser({ defaultFields: defaultFields?.createUser ?? {}, typeVisitCount: { ...typeVisitCount, "User": (typeVisitCount["User"] ?? 0) + 1 } }) : undefined),
                };
              }

              export const Mutation = createMutation();
              export function createUser({ defaultFields, typeVisitCount = {} } = {}) {
              return {
                  id: __id({ name: "xxxx-xxxx-xxxx-xxxx", key:"User.id" }),
                  name: "string",
                  email: "string",
                };
              }

              export const User = createUser();"
            `);
        });
    });
    describe("execute generateCode", () => {
        it("generates code for a simple Query type", () => {
            const code = generateCodeFromSchema({
                schema: `
        type Query {
            hello: String
        }`,
                outputType: "commonjs",
            });
            const exports = {};
            vm.runInNewContext(code, { exports });
            expect(exports).toMatchInlineSnapshot(`
              {
                "Query": {
                  "hello": "string",
                },
                "createQuery": [Function],
              }
            `);
        });
        it("generates code for a recursive type", () => {
            const _code = generateCodeFromSchema({
                schema: `
# Author and Book are recursive
type Author {
    name: String!
    books: [Book]
}
type Book {
    title: String!
    author: Author
}    
`,
                outputType: "javascript",
            });
            // eval using import();

            expect(exports).toMatchInlineSnapshot("{}");
        });
    });
    describe("example directive", () => {
        describe("generateCode", () => {
            describe("with example directives", () => {
                it("generates code for a simple Query type with @exampleString directive", () => {
                    expect(
                        generateCodeFromSchema({
                            schema: `
        type Query {
            hello: String @exampleString(value: "Hello, World!")
        }
    `,
                        }),
                    ).toMatchInlineSnapshot(`
                      "let __idGlobalId = 0; // global id
                      const __idContextCountMap = new Map() // context count
                      function __id({ name, key }) {
                          const count = __idContextCountMap.get(key) ?? 0;
                          const id = name + "_g" + String(__idGlobalId) + "_c" + String(count);
                          __idGlobalId += 1;
                          __idContextCountMap.set(key, count + 1);
                          return id;
                      }
                      export function createQuery({ defaultFields, typeVisitCount = {} } = {}) {
                      return {
                          hello: "Hello, World!",
                        };
                      }

                      export const Query = createQuery();"
                    `);
                });

                it("generates code for a Mutation type with @exampleID and @exampleString directives", () => {
                    expect(
                        generateCodeFromSchema({
                            schema: `
        type Mutation {
            addMessage(content: String!): Message
        }

        type Message {
            id: ID! @exampleID(value: "1234")
            content: String! @exampleString(value: "Hello, World!")
        }
    `,
                        }),
                    ).toMatchInlineSnapshot(`
                      "let __idGlobalId = 0; // global id
                      const __idContextCountMap = new Map() // context count
                      function __id({ name, key }) {
                          const count = __idContextCountMap.get(key) ?? 0;
                          const id = name + "_g" + String(__idGlobalId) + "_c" + String(count);
                          __idGlobalId += 1;
                          __idContextCountMap.set(key, count + 1);
                          return id;
                      }
                      export function createMutation({ defaultFields, typeVisitCount = {} } = {}) {
                      return {
                          addMessage: ((typeVisitCount["Message"] ?? 0) < 2 ? createMessage({ defaultFields: defaultFields?.addMessage ?? {}, typeVisitCount: { ...typeVisitCount, "Message": (typeVisitCount["Message"] ?? 0) + 1 } }) : undefined),
                        };
                      }

                      export const Mutation = createMutation();
                      export function createMessage({ defaultFields, typeVisitCount = {} } = {}) {
                      return {
                          id: __id({ name: "1234", key:"Message.id.1234" }),
                          content: "Hello, World!",
                        };
                      }

                      export const Message = createMessage();"
                    `);
                });

                it("generates code for a Subscription type with @exampleID and @exampleString directives", () => {
                    expect(
                        generateCodeFromSchema({
                            schema: `
        type Subscription {
            messageAdded: Message
        }

        type Message {
            id: ID! @exampleID(value: "1234")
            content: String! @exampleString(value: "Hello, World!")
        }
    `,
                        }),
                    ).toMatchInlineSnapshot(`
                      "let __idGlobalId = 0; // global id
                      const __idContextCountMap = new Map() // context count
                      function __id({ name, key }) {
                          const count = __idContextCountMap.get(key) ?? 0;
                          const id = name + "_g" + String(__idGlobalId) + "_c" + String(count);
                          __idGlobalId += 1;
                          __idContextCountMap.set(key, count + 1);
                          return id;
                      }
                      export function createSubscription({ defaultFields, typeVisitCount = {} } = {}) {
                      return {
                          messageAdded: ((typeVisitCount["Message"] ?? 0) < 2 ? createMessage({ defaultFields: defaultFields?.messageAdded ?? {}, typeVisitCount: { ...typeVisitCount, "Message": (typeVisitCount["Message"] ?? 0) + 1 } }) : undefined),
                        };
                      }

                      export const Subscription = createSubscription();
                      export function createMessage({ defaultFields, typeVisitCount = {} } = {}) {
                      return {
                          id: __id({ name: "1234", key:"Message.id.1234" }),
                          content: "Hello, World!",
                        };
                      }

                      export const Message = createMessage();"
                    `);
                });

                it("generates code for an enum type with @exampleID directive", () => {
                    expect(
                        generateCodeFromSchema({
                            schema: `
        enum Status {
            ACTIVE
            INACTIVE
        }

        type User {
            id: ID! @exampleID(value: "1234")
            status: Status!
        }
    `,
                        }),
                    ).toMatchInlineSnapshot(`
                      "let __idGlobalId = 0; // global id
                      const __idContextCountMap = new Map() // context count
                      function __id({ name, key }) {
                          const count = __idContextCountMap.get(key) ?? 0;
                          const id = name + "_g" + String(__idGlobalId) + "_c" + String(count);
                          __idGlobalId += 1;
                          __idContextCountMap.set(key, count + 1);
                          return id;
                      }
                      const Status = {
                        ACTIVE: "ACTIVE",
                        INACTIVE: "INACTIVE",
                      };

                      export function createUser({ defaultFields, typeVisitCount = {} } = {}) {
                      return {
                          id: __id({ name: "1234", key:"User.id.1234" }),
                          status: Object.values(Status)[0],
                        };
                      }

                      export const User = createUser();"
                    `);
                });

                it("generates code for an interface with @exampleID, @exampleString, and @exampleInt directives", () => {
                    expect(
                        generateCodeFromSchema({
                            schema: `
        interface Animal {
            id: ID! @exampleID(value: "1234")
            name: String! @exampleString(value: "Tom")
        }

        type Cat implements Animal {
            id: ID! @exampleID(value: "1234")
            name: String! @exampleString(value: "Tom")
            livesLeft: Int @exampleInt(value: 9)
        }

        type Dog implements Animal {
            id: ID! @exampleID(value: "1234")
            name: String! @exampleString(value: "Spike")
            breed: String @exampleString(value: "Bulldog")
        }
    `,
                        }),
                    ).toMatchInlineSnapshot(`
                      "let __idGlobalId = 0; // global id
                      const __idContextCountMap = new Map() // context count
                      function __id({ name, key }) {
                          const count = __idContextCountMap.get(key) ?? 0;
                          const id = name + "_g" + String(__idGlobalId) + "_c" + String(count);
                          __idGlobalId += 1;
                          __idContextCountMap.set(key, count + 1);
                          return id;
                      }

                      function createAnimal({ defaultFields, typeVisitCount = {} } = {}) {
                      return {
                          __typename: "Cat",
                          ...((typeVisitCount["Cat"] ?? 0) < 2 ? createCat({ defaultFields: defaultFields?.Animal ?? {}, typeVisitCount: { ...typeVisitCount, "Cat": (typeVisitCount["Cat"] ?? 0) + 1 } }) : undefined)
                      };
                      }
                      export function createCat({ defaultFields, typeVisitCount = {} } = {}) {
                      return {
                          id: __id({ name: "1234", key:"Cat.id.1234" }),
                          name: "Tom",
                          livesLeft: 9,
                        };
                      }

                      export const Cat = createCat();
                      export function createDog({ defaultFields, typeVisitCount = {} } = {}) {
                      return {
                          id: __id({ name: "1234", key:"Dog.id.1234" }),
                          name: "Spike",
                          breed: "Bulldog",
                        };
                      }

                      export const Dog = createDog();"
                    `);
                });

                it("generates code for input types with @exampleString directive", () => {
                    expect(
                        generateCodeFromSchema({
                            schema: `
        input NewUserInput {
            name: String!
            email: String!
        }

        type Mutation {
            createUser(input: NewUserInput!): User
        }

        type User {
            id: ID! @exampleID(value: "1234")
            name: String! @exampleString(value: "John Doe")
            email: String! @exampleString(value: "john.doe@example.com")
        }
    `,
                        }),
                    ).toMatchInlineSnapshot(`
                      "let __idGlobalId = 0; // global id
                      const __idContextCountMap = new Map() // context count
                      function __id({ name, key }) {
                          const count = __idContextCountMap.get(key) ?? 0;
                          const id = name + "_g" + String(__idGlobalId) + "_c" + String(count);
                          __idGlobalId += 1;
                          __idContextCountMap.set(key, count + 1);
                          return id;
                      }
                      export function createNewUserInput({ defaultFields, typeVisitCount = {} } = {}) {
                      return {
                          name: "string",
                          email: "string",
                        };
                      }

                      export const NewUserInput = createNewUserInput();
                      export function createMutation({ defaultFields, typeVisitCount = {} } = {}) {
                      return {
                          createUser: ((typeVisitCount["User"] ?? 0) < 2 ? createUser({ defaultFields: defaultFields?.createUser ?? {}, typeVisitCount: { ...typeVisitCount, "User": (typeVisitCount["User"] ?? 0) + 1 } }) : undefined),
                        };
                      }

                      export const Mutation = createMutation();
                      export function createUser({ defaultFields, typeVisitCount = {} } = {}) {
                      return {
                          id: __id({ name: "1234", key:"User.id.1234" }),
                          name: "John Doe",
                          email: "john.doe@example.com",
                        };
                      }

                      export const User = createUser();"
                    `);
                });
            });
        });

        it("generates code for exampleId and array", () => {
            expect(
                generateCodeFromSchema({
                    schema: `
                type Query {
                    books: [Book!]
                }
                type Book {
                  id: ID! @exampleID(value: "book-id")
                }
                `,
                }),
            ).toMatchInlineSnapshot(`
              "let __idGlobalId = 0; // global id
              const __idContextCountMap = new Map() // context count
              function __id({ name, key }) {
                  const count = __idContextCountMap.get(key) ?? 0;
                  const id = name + "_g" + String(__idGlobalId) + "_c" + String(count);
                  __idGlobalId += 1;
                  __idContextCountMap.set(key, count + 1);
                  return id;
              }
              export function createQuery({ defaultFields, typeVisitCount = {} } = {}) {
              return {
                  books: Array.from({ length: 3 }).map(() => ((typeVisitCount["Book"] ?? 0) < 2 ? createBook({ defaultFields: defaultFields?.books ?? {}, typeVisitCount: { ...typeVisitCount, "Book": (typeVisitCount["Book"] ?? 0) + 1 } }) : undefined)).filter(Boolean),
                };
              }

              export const Query = createQuery();
              export function createBook({ defaultFields, typeVisitCount = {} } = {}) {
              return {
                  id: __id({ name: "book-id", key:"Book.id.book-id" }),
                };
              }

              export const Book = createBook();"
            `);
        });
        it("generates code for a recursive type between two types", () => {
            expect(
                generateCodeFromSchema({
                    schema: `
        type Category {
            id: ID! @exampleID(value: "1234")
            name: String! @exampleString(value: "Electronics")
            subCategory: SubCategory
        }

        type SubCategory {
            id: ID! @exampleID(value: "5678")
            name: String! @exampleString(value: "Computers")
            parent: Category
        }
    `,
                }),
            ).toMatchInlineSnapshot(`
              "let __idGlobalId = 0; // global id
              const __idContextCountMap = new Map() // context count
              function __id({ name, key }) {
                  const count = __idContextCountMap.get(key) ?? 0;
                  const id = name + "_g" + String(__idGlobalId) + "_c" + String(count);
                  __idGlobalId += 1;
                  __idContextCountMap.set(key, count + 1);
                  return id;
              }
              export function createCategory({ defaultFields, typeVisitCount = {} } = {}) {
              return {
                  id: __id({ name: "1234", key:"Category.id.1234" }),
                  name: "Electronics",
                  subCategory: ((typeVisitCount["SubCategory"] ?? 0) < 2 ? createSubCategory({ defaultFields: defaultFields?.subCategory ?? {}, typeVisitCount: { ...typeVisitCount, "SubCategory": (typeVisitCount["SubCategory"] ?? 0) + 1 } }) : undefined),
                };
              }

              export const Category = createCategory();
              export function createSubCategory({ defaultFields, typeVisitCount = {} } = {}) {
              return {
                  id: __id({ name: "5678", key:"SubCategory.id.5678" }),
                  name: "Computers",
                  parent: ((typeVisitCount["Category"] ?? 0) < 2 ? createCategory({ defaultFields: defaultFields?.parent ?? {}, typeVisitCount: { ...typeVisitCount, "Category": (typeVisitCount["Category"] ?? 0) + 1 } }) : undefined),
                };
              }

              export const SubCategory = createSubCategory();"
            `);
        });
    });
    it("can output commonjs code", () => {
        expect(
            generateCodeFromSchema({
                schema: `
        type Query {
            hello: String
        }
    `,
                outputType: "commonjs",
            }),
        ).toMatchInlineSnapshot(`
          "let __idGlobalId = 0; // global id
          const __idContextCountMap = new Map() // context count
          function __id({ name, key }) {
              const count = __idContextCountMap.get(key) ?? 0;
              const id = name + "_g" + String(__idGlobalId) + "_c" + String(count);
              __idGlobalId += 1;
              __idContextCountMap.set(key, count + 1);
              return id;
          }
          function createQuery({ defaultFields, typeVisitCount = {} } = {}) {
          return {
              hello: "string",
            };
          }
          exports.createQuery = createQuery;
          const Query = createQuery();
          exports.Query = Query;"
        `);
    });
    it("can output TypeScript code", () => {
        expect(
            generateCodeFromSchema({
                schema: `
        type Query {
            hello: String
        }
    `,
                outputType: "typescript",
            }),
        ).toMatchInlineSnapshot(`
          "import type { 
            Query
          } from './type.ts';

          let __idGlobalId = 0; // global id
          const __idContextCountMap = new Map<string, number>() // context count
          function __id({ name, key }: { name: string; key: string; }): string {
              const count = __idContextCountMap.get(key) ?? 0;
              const id = name + "_g" + String(__idGlobalId) + "_c" + String(count);
              __idGlobalId += 1;
              __idContextCountMap.set(key, count + 1);
              return id;
          }
          export function createQuery({ defaultFields, typeVisitCount = {} }: { defaultFields?: Partial<Query>, typeVisitCount?: Record<string, number> } = {}): Query {
          return {
              hello: "string",
            };
          }

          export const Query = createQuery();"
        `);
    });
    it("can output TypeScript code with outputType: 'typescript'", () => {
        expect(
            generateCodeFromSchema({
                schema: `
        enum Status {
            ACTIVE
            INACTIVE
        }
       
        type User {
            id: ID!
            status: Status!
        }
        `,
                outputType: "typescript",
            }),
        ).toMatchInlineSnapshot(`
          "import type { 
            User
          } from './type.ts';

          let __idGlobalId = 0; // global id
          const __idContextCountMap = new Map<string, number>() // context count
          function __id({ name, key }: { name: string; key: string; }): string {
              const count = __idContextCountMap.get(key) ?? 0;
              const id = name + "_g" + String(__idGlobalId) + "_c" + String(count);
              __idGlobalId += 1;
              __idContextCountMap.set(key, count + 1);
              return id;
          }
          const Status = {
            ACTIVE: "ACTIVE",
            INACTIVE: "INACTIVE",
          } as const;

          export function createUser({ defaultFields, typeVisitCount = {} }: { defaultFields?: Partial<User>, typeVisitCount?: Record<string, number> } = {}): User {
          return {
              id: __id({ name: "xxxx-xxxx-xxxx-xxxx", key:"User.id" }),
              status: Object.values(Status)[0],
            };
          }

          export const User = createUser();"
        `);
    });
    it("should support enum", () => {
        expect(
            generateCodeFromSchema({
                schema: `
        enum Status {
            ACTIVE
            INACTIVE
        }
       
        type User {
            id: ID!
            status: Status!
        }
        `,
            }),
        ).toMatchInlineSnapshot(`
          "let __idGlobalId = 0; // global id
          const __idContextCountMap = new Map() // context count
          function __id({ name, key }) {
              const count = __idContextCountMap.get(key) ?? 0;
              const id = name + "_g" + String(__idGlobalId) + "_c" + String(count);
              __idGlobalId += 1;
              __idContextCountMap.set(key, count + 1);
              return id;
          }
          const Status = {
            ACTIVE: "ACTIVE",
            INACTIVE: "INACTIVE",
          };

          export function createUser({ defaultFields, typeVisitCount = {} } = {}) {
          return {
              id: __id({ name: "xxxx-xxxx-xxxx-xxxx", key:"User.id" }),
              status: Object.values(Status)[0],
            };
          }

          export const User = createUser();"
        `);
    });
});
