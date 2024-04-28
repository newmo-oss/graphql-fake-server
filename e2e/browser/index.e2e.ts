import { afterAll, beforeAll, it } from 'vitest';
import { run } from "@newmo/graphql-fake-server/cli";
it('integration test', async () => {
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
        if(typeof ret ==="function")
            closeServer = ret;
    });
    afterAll(() => {
        closeServer?.();
    });
    it("request to server", async () => {
        const response = await fetch("http://localhost:4000/graphql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query: `
                    query {
                        hello
                    }
                `,
            }),
        });
        const { data } = await response.json();
        expect(data).toEqual({ hello: "Hello World!" });
    }
});
