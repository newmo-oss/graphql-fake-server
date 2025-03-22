import type { GraphQLESLintRule } from "@graphql-eslint/eslint-plugin";

export const requiredErrorDirectiveRule: GraphQLESLintRule = {
    meta: {
        type: "problem",
        docs: {
            category: "Best Practices",
            description: "Require @error directive on fields named errors",
            url: "https://github.com/newmo-oss/graphql-fake-server", // TODO: Add specific URL for the rule
            recommended: true,
        },
        messages: {
            missingErrorDirective:
                "@error: Mark the fields as error fields. This fields make empty array by default. Without @error directive, the errors field will have default fake values, which may cause unexpected error responses.",
        },
        schema: [], // no options
    },
    create(context) {
        return {
            // Detect ObjectTypeDefinition with fields named "errors"
            ObjectTypeDefinition(node) {
                const errorsField = node.fields?.find((field) => {
                    return field.name?.value === "errors";
                });

                if (!errorsField) {
                    return;
                }

                // Check if the errors field has @error directive
                const hasErrorDirective = errorsField.directives?.some((directive) => {
                    return directive.name.value === "error";
                });

                if (!hasErrorDirective) {
                    context.report({
                        node: errorsField,
                        messageId: "missingErrorDirective",
                    });
                }
            },
        };
    },
};
