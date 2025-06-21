import type { GraphQLESLintRule } from "@graphql-eslint/eslint-plugin";

export const requiredErrorDirectiveRule: GraphQLESLintRule = {
  meta: {
    type: "problem",
    docs: {
      category: "Operations",
      // description: "Require @error directive on fields named errors",
      // url: "https://github.com/newmo-oss/graphql-fake-server", // TODO: Add specific URL for the rule
      // recommended: true,
    },
    messages: {
      missingErrorDirective: "should have `@error` directive for `errors` field.",
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
