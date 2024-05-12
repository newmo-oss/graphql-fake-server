# @newmo/graphql-fake-server

GraphQL Fake Server and Toolkits for Declarative and Dynamic Fake.

## Motivation

`@newmo/graphql-fake-server` is for developers who use Fake data in GraphQL API.

`@newmo/graphql-fake-server` provides a two-way GraphQL API Fake.

- Declarative Fake
  - Support Declarative Fake for testing via GraphQL Schema
  - Fake directives are `@exampleID`, `@exampleString`, `@exampleInt`, `@exampleFloat`, `@exampleBoolean`.
  - It is Static Fake, so you can easily understand the fake data.
- Dynamic Fake
  - Support Framework-Agnostic fake for testing via HTTP
  - Fake server allow to register fake data via HTTP request
  - It is useful for integration testing GraphQL API with dynamic fake data.

The purpose is to be able to develop while keeping maintainable Fake by using these differently depending on the application.

This package is written in Node.js, but it is also available in other languages.
Main interface is HTTP, so you can use it in any language.

## Usage

### Declarative Fake

1. Install the package.

```bash
npm install @newmo/graphql-fake-server --save-dev
```

2. Add `@exampleID`, `@exampleString`, `@exampleInt`, `@exampleFloat`, `@exampleBoolean` directive to your schema and use it.

`graphql/schema.graphql`:

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

# Your schema
type Book {
    id: ID! @exampleID(value: "book-id")
    title: String! @exampleString(value: "The Great Gatsby")
    author: Author!
}
type Author {
    id: ID! @exampleID(value: "author-id")
    name: String! @exampleString(value: "F. Scott Fitzgerald")
    age: Int! @exampleInt(value: 33)
}
type Query {
    books: [Book!]!
}
```

4. Launch Fake Server specifying the schema.

```bash
$ npx graphql-fake-server --schema graphql/schema.graphql
```

5. The fake server will be launched at `http://localhost:4000`.

For example, send the following query:

```graphql
query {
  books {
    id
    title
    author {
      id
      name
      age
    }
  }
}
```

Return the following response:

```json
{
  "data": {
    "books": [
      {
        "id": "book-id00",
        "title": "The Great Gatsby",
        "author": {
          "id": "author-id10",
          "name": "F. Scott Fitzgerald",
          "age": 33
        }
      },
      {
        "id": "book-id01",
        "title": "The Great Gatsby",
        "author": {
          "id": "author-id11",
          "name": "F. Scott Fitzgerald",
          "age": 33
        }
      }
    ]
  }
}
```

### Dynamic Fake

1. Launch Fake Server.

```bash
$ npx graphql-fake-server
```

2. Register Fake Data via HTTP.

```ts
const sequenceId = "unique-sequence-id-1";
fetch('http://127.0.0.1:4000/fake', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        // sequence-id is the unique identifier of the fake data.
        'sequence-id': sequenceId
    },
    body: JSON.stringify({
        type: "operation",
        // operationName is the name of the operation in the GraphQL schema.
        operationName: "GetBooks",
        // data is the fake data to be returned.
        data: {
            books: [
                {
                    id: "book-id00",
                    title: "The Great Gatsby",
                }
              ]
        }
    }),
})
```

3. Request and get Fake Data via HTTP.

```ts
const sequenceId = "unique-sequence-id-1";
const response = await fetch('http://127.0.0.1:4000/query', {
   method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'sequence-id': sequenceId
    },
    body: JSON.stringify({
        query: `
            query GetBooks {
                books {
                    id
                    title
                }
            }
        `
    }),
});
const json = await response.json();
console.log(json);
/* Response is registered fake data.
{
  "data": {
    "books": [
      {
        "id": "book-id00",
        "title": "The Great Gatsby"
      }
    ]
  }
}
*/
```

> [!NOTE]
> If you use TypeScript, you can use [`@newmo/graphql-codegen-fake-server-client`](https://npmjs.com/package/@newmo/graphql-codegen-fake-server-client) to generate a client for the Fake Server.

## Examples

- [examples/e2e/node](./examples/e2e/node): Example of using Fake Server in Node.js.

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
- [wayfair-incubator/gqmock: Project generated via @wayfair-incubator oss-template](https://github.com/wayfair-incubator/gqmock)
