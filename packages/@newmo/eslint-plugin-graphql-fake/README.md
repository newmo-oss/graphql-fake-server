# @newmo/eslint-plugin-graphql-fake

ESLint plugin for GraphQL Fake Server. This plugin provides rules to prevent common issues when creating mock servers with GraphQL Fake.

## Installation

```bash
npm install --save-dev @newmo/eslint-plugin-graphql-fake
```

## Configuration

Add the following to your `eslint.config.js`:

```js
import graphqlFake from "@newmo/eslint-plugin-graphql-fake";

export default [
  // Use all recommended rules
  ...graphqlFake.configs.recommended,

  // Or configure individual rules
  {
    plugins: {
      "@newmo/graphql-fake": graphqlFake,
    },
    rules: {
      "@newmo/graphql-fake/required-error-directive": "error",
    },
  },
];
```

## Rules

- [`required-error-directive`](./docs/rules/required-error-directive.md): Requires the `@error` directive on fields named `errors`

## Resources

- [ESLint Flat Config Migration Guide](https://eslint.org/docs/latest/use/configure/migration-guide)

## License

MIT
