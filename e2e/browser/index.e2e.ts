import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { run } from "@newmo/graphql-fake-server/cli";

describe('integration test', async () => {
    let closeServer: () => void
    beforeAll(async () => {
        const ret = await run({
            values: {
                schema: "1-basic-schema.graphql",
                port: "4000",
                logLevel: "info",
            },
            positionals: []
        });
        if (typeof ret === "function")
            closeServer = ret;
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
                        "id": "author-id0",
                      },
                      "title": "The Great Gatsby",
                    },
                    {
                      "author": {
                        "id": "author-id0",
                      },
                      "title": "The Great Gatsby",
                    },
                    {
                      "author": {
                        "id": "author-id0",
                      },
                      "title": "The Great Gatsby",
                    },
                  ],
                  "id": "author-id0",
                  "name": "F. Scott Fitzgerald",
                },
                {
                  "age": 33,
                  "books": [
                    {
                      "author": {
                        "id": "author-id0",
                      },
                      "title": "The Great Gatsby",
                    },
                    {
                      "author": {
                        "id": "author-id0",
                      },
                      "title": "The Great Gatsby",
                    },
                    {
                      "author": {
                        "id": "author-id0",
                      },
                      "title": "The Great Gatsby",
                    },
                  ],
                  "id": "author-id0",
                  "name": "F. Scott Fitzgerald",
                },
                {
                  "age": 33,
                  "books": [
                    {
                      "author": {
                        "id": "author-id0",
                      },
                      "title": "The Great Gatsby",
                    },
                    {
                      "author": {
                        "id": "author-id0",
                      },
                      "title": "The Great Gatsby",
                    },
                    {
                      "author": {
                        "id": "author-id0",
                      },
                      "title": "The Great Gatsby",
                    },
                  ],
                  "id": "author-id0",
                  "name": "F. Scott Fitzgerald",
                },
              ],
            },
          }
        `);

    })
});
