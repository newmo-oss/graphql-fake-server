# @newmo/graphql-fake-server

GraphQL Fake Server.

## Motivation

- Static Path
  - Support Declarative Fake via `@example` directive.
- [ ] Dynamic Path
  - Support Framework-Agnostic Fake for testing via HTTP
  
## Installation

1. Add `@exampleID`, `@exampleString`, `@exampleInt`, `@exampleFloat`, `@exampleBoolean` directive to your schema.

```graphql
"""
@exampleID directive specifies an example value for a ID field.
This example value is used in the fake data.
ID value will be unique between all ID fake data.
"""
directive @exampleID(
  """
  The value of the ID field.
  @exampleID(value: "id")
  """
  value: ID!
) on FIELD_DEFINITION
"""
@exampleString directive specifies an example value for a String field.
This example value is used in the fake data.
"""
directive @exampleString(
  """
  The value of the String field.
  @exampleString(value: "example")
  """
  value: String!
) on FIELD_DEFINITION
"""
@exampleInt directive specifies an example value for a Inf field.
This example value is used in the fake data.
"""
directive @exampleInt(
  """
  The value of the Int field.
  @exampleInt(value: 1)
  """
  value: Int!
) on FIELD_DEFINITION
"""
@exampleFloat directive specifies an example value for a Float field.
This example value is used in the fake data.
"""
directive @exampleFloat(
  """
  The value of the Float field.
  @exampleFloat(value: 1.0)
  """
  value: Float!
) on FIELD_DEFINITION
"""
@exampleBoolean directive specifies an example value for a Boolean field.
This example value is used in the fake data.
"""
directive @exampleBoolean(
  """
  The value of the Boolean field.
  @exampleBoolean(value: true)
  """
  value: Boolean!
) on FIELD_DEFINITION
```

## Usage


## Tests

- [ ] Write How to Tests

## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

## License

MIT 

## Credits

- [mizdra/graphql-codegen-typescript-fabbrica: GraphQL Code Generator Plugin to define fake data factory.](https://github.com/mizdra/graphql-codegen-typescript-fabbrica)
- [graphql-kit/graphql-faker: 🎲 Mock or extend your GraphQL API with faked data. No coding required.](https://github.com/graphql-kit/graphql-faker)
