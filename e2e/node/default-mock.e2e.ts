import { GraphQLClient } from "graphql-request";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type CreateBookInput,
    CreateFooUrlDocument,
    GetSimpleUnionDocument,
    GetUserNamesArrayExampleDocument,
    GotUnionUserDocument,
} from "./generated/graphql.js";
import { createApolloClient, startTestServer } from "./helpers.js";

describe("default-mock", async () => {
    let server: Awaited<ReturnType<typeof startTestServer>>["server"];
    let fakeServerUrl = "";
    beforeAll(async () => {
        const result = await startTestServer({ fakeServer: 4020, apolloServer: 4021 });
        server = result.server;
        fakeServerUrl = result.urls.fakeServer;
    });
    afterAll(() => {
        server?.stop();
    });
    describe("without fake", () => {
        it("should work createFooURL mutation", async () => {
            // request to server
            const client = createApolloClient({
                uri: `${fakeServerUrl}/graphql`,
            });
            const response = await client.mutate<CreateBookInput>({
                mutation: CreateFooUrlDocument,
                variables: {
                    input: {
                        URL: "https://example.com",
                    },
                },
            });
            expect(response.data).toMatchInlineSnapshot(`
              {
                "createFooURL": {
                  "URL": "string",
                  "__typename": "FooURLPayload",
                  "errors": [
                    {
                      "__typename": "CreateFooURLErrorDetail",
                      "code": "FAILED_TO_CREATE_FOO_URL",
                      "message": "string",
                    },
                    {
                      "__typename": "CreateFooURLErrorDetail",
                      "code": "FAILED_TO_CREATE_FOO_URL",
                      "message": "string",
                    },
                    {
                      "__typename": "CreateFooURLErrorDetail",
                      "code": "FAILED_TO_CREATE_FOO_URL",
                      "message": "string",
                    },
                  ],
                },
              }
            `);
        });
        it("should return Custom Scalar Default Fake Value", async () => {
            const _sequenceId = crypto.randomUUID();
            const client = new GraphQLClient(`${fakeServerUrl}/graphql`);
            // get fake response
            const response = await client.request(GotUnionUserDocument);
            expect(response).toMatchInlineSnapshot(`
              {
                "unionUser": {
                  "birthDate": "2022-01-01",
                  "birthYYYYMM": "2022-01",
                  "id": "xxxx-xxxx-xxxx-xxxx_g6_c1",
                  "name": "string",
                },
              }
            `);
        });
        it("should return the first concrete type of a union (First | Second | Third)", async () => {
            const client = new GraphQLClient(`${fakeServerUrl}/graphql`);
            const response = await client.request(GetSimpleUnionDocument);
            // Union always returns the first concrete type declared in the schema
            expect(response.simpleUnion?.__typename).toBe("First");
            expect(response).toMatchInlineSnapshot(`
              {
                "simpleUnion": {
                  "__typename": "First",
                  "value": "first-value",
                },
              }
            `);
        });
    });
    describe("@example ", () => {
        it("should fetch array example values", async () => {
            // just request
            const client = new GraphQLClient(`${fakeServerUrl}/graphql`);
            // get fake response
            const response = await client.request(GetUserNamesArrayExampleDocument);
            expect(response).toMatchInlineSnapshot(`
          {
            "userNamesArray": {
              "names": [
                "name1",
                "name2",
              ],
            },
          }
        `);
        });
        it("request to server and get response", async () => {
            const response = await fetch(`${fakeServerUrl}/graphql`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    operationName: "GetAuthors",
                    query: `
                    query GetAuthors {
                      authors {
                        id
                        name
                        age
                        books {
                          title
                          author {
                            id
                          }
                          genre
                        }
                      }
                    }
                `,
                }),
            });
            const data = await response.json();
            expect(data).toMatchInlineSnapshot(`
              {
                "data": {
                  "authors": [
                    {
                      "age": 33,
                      "books": [
                        {
                          "author": {
                            "id": "author-id_g16_c4",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                        {
                          "author": {
                            "id": "author-id_g17_c5",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                        {
                          "author": {
                            "id": "author-id_g18_c6",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                      ],
                      "id": "author-id_g10_c1",
                      "name": "F. Scott Fitzgerald",
                    },
                    {
                      "age": 33,
                      "books": [
                        {
                          "author": {
                            "id": "author-id_g22_c7",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                        {
                          "author": {
                            "id": "author-id_g23_c8",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                        {
                          "author": {
                            "id": "author-id_g24_c9",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                      ],
                      "id": "author-id_g11_c2",
                      "name": "F. Scott Fitzgerald",
                    },
                    {
                      "age": 33,
                      "books": [
                        {
                          "author": {
                            "id": "author-id_g28_c10",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                        {
                          "author": {
                            "id": "author-id_g29_c11",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                        {
                          "author": {
                            "id": "author-id_g30_c12",
                          },
                          "genre": "FICTION",
                          "title": "The Great Gatsby",
                        },
                      ],
                      "id": "author-id_g12_c3",
                      "name": "F. Scott Fitzgerald",
                    },
                  ],
                },
              }
            `);
        });
    });
    describe("@error", () => {
        it("should return empty array for field with @error directive", async () => {
            const sequenceId = crypto.randomUUID();
            const client = new GraphQLClient(`${fakeServerUrl}/graphql`, {
                headers: {
                    "sequence-id": sequenceId,
                },
            });
            const query = `
              query {
                userWithErrors {
                  id
                  name
                  errors {
                    message
                  }
                }
              }
            `;
            const response = await client.request(query);
            expect(response).toMatchInlineSnapshot(`
              {
                "userWithErrors": {
                  "errors": [],
                  "id": "xxxx-xxxx-xxxx-xxxx_g31_c1",
                  "name": "string",
                },
              }
            `);
        });
    });
});
