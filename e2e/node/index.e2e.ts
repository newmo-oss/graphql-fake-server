import { createFakeServer } from "@newmo/graphql-fake-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("integration test", async () => {
    let closeServer: () => void;
    beforeAll(async () => {
        const ret = await createFakeServer({
            schemaFilePath: "./1-basic-schema.graphql",
        });
        if (typeof ret === "function") closeServer = ret;
    });
    afterAll(() => {
        closeServer?.();
    });
    it("request to server and get response", async () => {
        const response = await fetch("http://localhost:4000/graphql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query: `
                    query {
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
                        "id": "author-id313",
                      },
                      "genre": "FICTION",
                      "title": "The Great Gatsby",
                    },
                    {
                      "author": {
                        "id": "author-id314",
                      },
                      "genre": "FICTION",
                      "title": "The Great Gatsby",
                    },
                    {
                      "author": {
                        "id": "author-id315",
                      },
                      "genre": "FICTION",
                      "title": "The Great Gatsby",
                    },
                  ],
                  "id": "author-id112",
                  "name": "F. Scott Fitzgerald",
                },
                {
                  "age": 33,
                  "books": [
                    {
                      "author": {
                        "id": "author-id317",
                      },
                      "genre": "FICTION",
                      "title": "The Great Gatsby",
                    },
                    {
                      "author": {
                        "id": "author-id318",
                      },
                      "genre": "FICTION",
                      "title": "The Great Gatsby",
                    },
                    {
                      "author": {
                        "id": "author-id319",
                      },
                      "genre": "FICTION",
                      "title": "The Great Gatsby",
                    },
                  ],
                  "id": "author-id116",
                  "name": "F. Scott Fitzgerald",
                },
                {
                  "age": 33,
                  "books": [
                    {
                      "author": {
                        "id": "author-id321",
                      },
                      "genre": "FICTION",
                      "title": "The Great Gatsby",
                    },
                    {
                      "author": {
                        "id": "author-id322",
                      },
                      "genre": "FICTION",
                      "title": "The Great Gatsby",
                    },
                    {
                      "author": {
                        "id": "author-id323",
                      },
                      "genre": "FICTION",
                      "title": "The Great Gatsby",
                    },
                  ],
                  "id": "author-id120",
                  "name": "F. Scott Fitzgerald",
                },
              ],
            },
          }
        `);
    });
});
