import * as parser from "@graphql-eslint/eslint-plugin";
import { describe } from "vitest";
import { VitestESLintRuleTester } from "./VitestESLintRuleTester.js";
import { requiredErrorDirectiveRule } from "./required-error-directive.js";

const ruleTester = new VitestESLintRuleTester({
    languageOptions: {
        parser,
        parserOptions: {
            graphQLConfig: {
                schema: /* GraphQL */ `
          # Optionally, your schema, your rule could have access to it
        `,
                documents: /* GraphQL */ `
          # Optionally, your operations, your rule could have access to them
        `,
            },
        },
    },
});

describe("required-error-directive", () => {
    // @ts-expect-error -- GraphQLESLintRule type mismatch
    ruleTester.run("required-error-directive", requiredErrorDirectiveRule, {
        valid: [
            // 1. Valid case: errors field has @error directive
            {
                code: `
        type SendCustomEventPayload {
          customEventId: String
          errors: [SendCustomEventError!]! @error
        }
        `,
            },
            // 2. Valid case: no errors field
            {
                code: `
        type UserType {
          id: ID!
          name: String!
        }
        `,
            },
        ],
        invalid: [
            // Invalid case: missing @error directive on errors field
            {
                code: `
        type SendCustomEventPayload {
          customEventId: String
          errors: [SendCustomEventError!]!
        }
        `,
                errors: [
                    {
                        messageId: "missingErrorDirective",
                    },
                ],
            },
        ],
    });
});
