import { buildSchema, parse } from "graphql";
import { describe, expect, it } from "vitest";
import { plugin } from "./graphql-codegen-fake-server-client.js";

const schema = buildSchema(`
    type Mutation {
        deactivateAIDispatch: Boolean
        createURLRideHistory(name: String!): String
    }
    type Query {
        listAPIKeys: [String!]!
    }
`);

const runPlugin = (querySource: string) => {
    const documents = [
        {
            location: "test.graphql",
            document: parse(querySource),
        },
    ];
    return plugin(
        schema,
        documents,
        {
            typesFile: "./graphql.js",
            fakeServerEndpoint: "http://127.0.0.1:4000/fake",
        },
        { outputFile: "fake-client.ts" },
    ) as string;
};

describe("graphql-codegen-fake-server-client plugin", () => {
    it("preserves original operation name for mutations with consecutive uppercase letters (AI)", () => {
        const output = runPlugin(`
            mutation DeactivateAIDispatch {
                deactivateAIDispatch
            }
        `);
        // The body sent to the fake server must use the ORIGINAL operation name
        // because the real GraphQL client sends operationName as written in .graphql,
        // not the pascalCase-converted form.
        expect(output).toContain(`operationName: "DeactivateAIDispatch"`);
        expect(output).not.toContain(`operationName: "DeactivateAiDispatch"`);
    });

    it("preserves original operation name for mutations with consecutive uppercase letters (URL)", () => {
        const output = runPlugin(`
            mutation CreateURLRideHistory($name: String!) {
                createURLRideHistory(name: $name)
            }
        `);
        expect(output).toContain(`operationName: "CreateURLRideHistory"`);
        expect(output).not.toContain(`operationName: "CreateUrlRideHistory"`);
    });

    it("preserves original operation name for queries with consecutive uppercase letters (API)", () => {
        const output = runPlugin(`
            query ListAPIKeys {
                listAPIKeys
            }
        `);
        expect(output).toContain(`operationName: "ListAPIKeys"`);
        expect(output).not.toContain(`operationName: "ListApiKeys"`);
    });

    it("still converts the method name itself to match generated type names", () => {
        const output = runPlugin(`
            mutation DeactivateAIDispatch {
                deactivateAIDispatch
            }
        `);
        // The method name and type references should use the pascalCase-converted form
        // (Code Generator's default) so they line up with the generated types.
        expect(output).toContain("registerDeactivateAiDispatchMutationResponse");
        expect(output).toContain("calledDeactivateAiDispatchMutation");
        expect(output).toContain("DeactivateAiDispatchMutation");
    });
});
