import { onError as apolloOnError } from "@apollo/client/link/error";
import { GraphQLClient } from "graphql-request";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
    GetBooksDocument,
    GetDogDocument,
    UseMutationErrorPatternMutationDocument,
    type UseMutationErrorPatternMutationMutation,
} from "./generated/graphql.js";
import { createApolloClient, createTestFakeClient, startTestServer } from "./helpers.js";

const fakeClient = createTestFakeClient(4028);

describe("fake-error", async () => {
    let server: Awaited<ReturnType<typeof startTestServer>>["server"];
    let fakeServerUrl = "";
    beforeAll(async () => {
        const result = await startTestServer({ fakeServer: 4028, apolloServer: 4029 });
        server = result.server;
        fakeServerUrl = result.urls.fakeServer;
    });
    afterAll(() => {
        server?.stop();
    });

    it("register fake error response for query", async () => {
        const sequenceId = crypto.randomUUID();
        // register fake error response for GetBooks query
        const resRegister = await fakeClient.registerGetBooksQueryErrorResponse(sequenceId, {
            errors: [{ message: "fake error message" }],
            responseStatusCode: 400,
        });
        expect(resRegister).toMatchInlineSnapshot(`
              {
                "ok": true,
              }
            `);
        // request to server
        const client = new GraphQLClient(`${fakeServerUrl}/graphql`, {
            headers: {
                "sequence-id": sequenceId,
            },
        });
        // get fake response
        try {
            await client.request(GetBooksDocument);
        } catch (e) {
            expect(e).toMatchInlineSnapshot(
                `[Error: GraphQL Error (Code: 400): {"response":{"status":400,"headers":{}},"request":{"query":"query GetBooks {\\n  books {\\n    id\\n    title\\n  }\\n}"}}]`,
            );
        }
    });
    it("register fake response for mutation errors pattern", async () => {
        const sequenceId = crypto.randomUUID();
        // register fake response for UseFooBarMutationMutation mutation
        const _resRegister =
            await fakeClient.registerUseMutationErrorPatternMutationMutationResponse(sequenceId, {
                __typename: "Mutation",
                useMutationErrorPattern: {
                    __typename: "UseMutationErrorPatternPayload",
                    errors: [
                        {
                            __typename: "GeneralError",
                            message: "error message",
                        },
                    ],
                },
            });
        // request to server
        const client = createApolloClient({
            uri: `${fakeServerUrl}/graphql`,
            sequenceId,
        });
        const response = await client.mutate<UseMutationErrorPatternMutationMutation>({
            mutation: UseMutationErrorPatternMutationDocument,
        });
        const errors = response.data?.useMutationErrorPattern.errors ?? [];
        const isError = errors.length > 0;
        expect(isError).toBe(true);
        expect(response).toMatchInlineSnapshot(`
        {
          "data": {
            "__typename": "Mutation",
            "useMutationErrorPattern": {
              "__typename": "UseMutationErrorPatternPayload",
              "errors": [
                {
                  "__typename": "GeneralError",
                  "message": "error message",
                },
              ],
            },
          },
        }
      `);
    });
    it("apollo client catch global errors", async () => {
        const sequenceId = crypto.randomUUID();
        // register fake response for UseFooBarMutationMutation mutation
        const _resRegister = await fakeClient.registerGetDogQueryErrorResponse(sequenceId, {
            errors: [
                {
                    message: "test error",
                },
            ],
            responseStatusCode: 400,
        });
        const spy = vi.fn();
        const errorLink = apolloOnError(spy);
        // request to server
        const client = createApolloClient({
            uri: `${fakeServerUrl}/graphql`,
            sequenceId,
            errorLink,
        });
        try {
            await client.query({
                query: GetDogDocument,
            });
            throw new Error("not reach");
        } catch {
            expect(spy).toBeCalled();
        }
    });
});
