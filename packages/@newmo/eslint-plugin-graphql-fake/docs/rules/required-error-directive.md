# required-error-directive

> Requires the `@error` directive on fields named `errors`

## Rule Details

This rule checks that all fields named `errors` in your GraphQL schema have the `@error` directive specified. This directive is necessary when using GraphQL Fake server to ensure error fields default to an empty array when generating mock data.

## Options

This rule has no configuration options.

## Pass

```graphql
type SendCustomEventPayload {
  customEventId: String
  errors: [SendCustomEventError!]! @error
}

type UpdateUserResult {
  user: User
  errors: [UserError!]! @error
}

# Types without error fields are not affected
type User {
  id: ID!
  name: String!
}
```

## Fail

```graphql
type SendCustomEventPayload {
  customEventId: String
  # Missing @error directive on errors field
  errors: [SendCustomEventError!]!
}

type UpdateUserResult {
  user: User
  # Missing @error directive on errors field
  errors: [UserError!]!
}
```

## Error Message

```
@error: Mark the fields as error fields. This fields make empty array by default. Without @error directive, the errors field will have default fake values, which may cause unexpected error responses.
```

## Technical Details

### Problem Description

Error handling is a crucial aspect of GraphQL implementation. When using GraphQL Fake server, default values are automatically generated for unspecified fields during mock data generation.

For `errors` fields without the `@error` directive, the following issues occur:

1. Default dummy error data is generated
2. All responses appear to be in an error state
3. Frontend development testing becomes challenging

### Solution

By using the `@error` directive:

1. Error fields default to an empty array `[]`
2. Success response testing becomes possible
3. Error data can be set only when needed

### GraphQL Error Handling Best Practices

There are two main approaches to handling errors in GraphQL:

1. Standard GraphQL errors (in the `errors` field)
2. Application-specific errors (in the payload's `errors` field)

This rule relates to the second approach and follows these best practices:

- Define errors as part of the schema
- Clearly type error definitions
- Default to success case (no errors)

## Resources

- [Guide to GraphQL Errors](https://productionreadygraphql.com/2020-08-01-guide-to-graphql-errors)
- [GraphQL Error Handling Best Practices](https://www.apollographql.com/blog/graphql/error-handling/full-stack-error-handling-with-graphql-apollo/)
- [GraphQL Specification - Errors](https://spec.graphql.org/draft/#sec-Errors)

## Version

This rule was introduced in @newmo/eslint-plugin-graphql-fake 0.1.0
