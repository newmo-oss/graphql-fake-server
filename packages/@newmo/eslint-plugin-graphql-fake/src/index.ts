import { requiredErrorDirectiveRule } from "./rules/required-error-directive.js";

export default {
    rules: {
        "required-error-directive": requiredErrorDirectiveRule,
    },
    configs: {
        recommended: {
            plugins: ["@newmo/graphql-fake"],
            rules: {
                "@newmo/graphql-fake/required-error-directive": "error",
            },
        },
    },
};
