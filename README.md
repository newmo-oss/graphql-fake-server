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
  - Fake server allow to register fake data via HTTP request `/fake` endpoint.
  - Fake server allow to get actual request data to any GraphQL operation via HTTP request `/fake/called` endpoint.
  - It is useful for integration testing GraphQL API with dynamic fake data.

The purpose is to be able to develop while keeping maintainable Fake by using these differently depending on the application.

This package is written in Node.js, but it is also available in other languages.
Main interface is HTTP, so you can use it in any language.

## Usage

### Declarative Fake

Declarative Fake is used to define fake data in the GraphQL schema.

1. Install the package.

```bash
npm install @newmo/graphql-fake-server --save-dev
```

2. Add example directives to the GraphQL schema.
  - Primitive types: `ID`, `String`, `Int`, `Float`, `Boolean`
    - `@exampleID`: Specifies an example value for a ID field.
    - `@exampleString`: Specifies an example value for a String field.
    - `@exampleInt`: Specifies an example value for a Int field.
    - `@exampleFloat`: Specifies an example value for a Float field.
    - `@exampleBoolean`: Specifies an example value for a Boolean field.
  - Array types: `[ID!]`, `[String!]`, `[Int!]`, `[Float!]`, `[Boolean!]`
    - `@exampleArrayID`: Specifies an example value for a array of ID field.
    - `@exampleArrayString`: Specifies an example value for a array of String field.
    - `@exampleArrayInt`: Specifies an example value for a array of Int field.
    - `@exampleArrayFloat`: Specifies an example value for a array of Float field.
    - `@exampleArrayBoolean`: Specifies an example value for a array of Boolean field.
  - Custom scalar types:
    - `@exampleScalarString`: Specifies an example value for a scalar field.
    - `@exampleScalarInt`: Specifies an example value for a scalar field.
    - `@exampleScalarFloat`: Specifies an example value for a scalar field.
    - `@exampleScalarBoolean`: Specifies an example value for a scalar field.
  - Special types:
    - `@error`: Mark the fields as error fields. This fields make empty array by default.

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
) on FIELD_DEFINITION | ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION
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
) on FIELD_DEFINITION | ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION
"""
@exampleInt directive specifies an example value for a Int field.
This example value is used in the fake data.
"""
directive @exampleInt(
  """
  The value of the Int field.
  @exampleInt(value: 1)
  """
  value: Int!
) on FIELD_DEFINITION | ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION
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
) on FIELD_DEFINITION | ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION
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
) on FIELD_DEFINITION | ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION

"""
@exampleArrayID directive specifies an example value for a array of ID field.
This example value is used in the fake data.
ID value will be unique between all ID fake data.
"""
directive @exampleArrayID(
  """
  The value of the ID field.
  @exampleArrayID(value: ["id1", "id2"])
  """
  values: [ID!]!
) on FIELD_DEFINITION | ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION
"""
@exampleArrayString directive specifies an example value for a array of String field.
This example value is used in the fake data.
"""
directive @exampleArrayString(
  """
  The value of the String field.
  @exampleArrayString(value: ["example1", "example2"])
  """
  values: [String!]!
) on FIELD_DEFINITION | ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION
"""
@exampleArrayInt directive specifies an example value for a array of Int field.
This example value is used in the fake data.
"""
directive @exampleArrayInt(
  """
  The value of the Int field.
  @exampleArrayInt(value: [1, 2])
  """
  values: [Int!]!
) on FIELD_DEFINITION | ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION
"""
@exampleArrayFloat directive specifies an example value for a array of Float field.
This example value is used in the fake data.
"""
directive @exampleArrayFloat(
  """
  The value of the Float field.
  @exampleArrayFloat(value: [1.0, 2.0])
  """
  values: [Float!]!
) on FIELD_DEFINITION | ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION
"""
@exampleArrayBoolean directive specifies an example value for a array of Boolean field.
This example value is used in the fake data.
"""
directive @exampleArrayBoolean(
  """
  The value of the Boolean field.
  @exampleArrayBoolean(value: [true, false])
  """
  values: [Boolean!]!
) on FIELD_DEFINITION | ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION
"""
@exampleScalarString directive specifies an example value for a scalar field.
This example value is used in the fake data.
"""
directive @exampleScalarString(
  """
  The value of the scalar field.
  scalar CustomString @exampleScalar(value: "example")
  """
  value: String!
) on SCALAR
"""
@exampleScalarInt directive specifies an example value for a scalar field.
This example value is used in the fake data.
"""
directive @exampleScalarInt(
  """
  The value of the scalar field.
  scalar CustomValue @exampleScalar(value: 1)
  """
  value: Int!
) on SCALAR
"""
@exampleScalarFloat directive specifies an example value for a scalar field.
This example value is used in the fake data.
"""
directive @exampleScalarFloat(
  """
  The value of the scalar field.
  scalar CustomValue @exampleScalar(value: 1.0)
  """
  value: Float!
) on SCALAR
"""
@exampleScalarBoolean directive specifies an example value for a scalar field.
This example value is used in the fake data.
"""
directive @exampleScalarBoolean(
  """
  The value of the scalar field.
  scalar CustomValue @exampleScalar(value: true)
  """
  value: Boolean!
) on SCALAR
"""
@error directive specifies a field as an error response field.
It allows setting an error response and specifying the field name.
"""
directive @error on FIELD_DEFINITION


# Your schema
type Book {
    id: ID! @exampleID(value: "book-id")
    title: String! @exampleString(value: "The Great Gatsby")
    author: Author!
    errors: [Error!]! @error
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

For example, send the following query to `http://localhost:4000/query`.

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

#### Examples of `@example*` directive

```graphql
"""
All example directives are used to define fake data.
"""
type TestThings {
    id: ID! @exampleID(value: "id")
    name: String! @exampleString(value: "example")
    age: Int! @exampleInt(value: 1)
    height: Float! @exampleFloat(value: 1.0)
    isBool: Boolean! @exampleBoolean(value: true)
    ids: [ID!]! @exampleArrayID(values: ["id1", "id2"])
    names: [String!]! @exampleArrayString(values: ["example1", "example2"])
    ages: [Int!]! @exampleArrayInt(values: [1, 2])
    heights: [Float!]! @exampleArrayFloat(values: [1.0, 2.0])
    isBools: [Boolean!]! @exampleArrayBoolean(values: [true, false])
}
```

### Dynamic Fake

Dynamic Fake is used to integration testing with dynamic fake data.

1. Launch Fake Server.

```bash
$ npx graphql-fake-server
```

2. Register Fake Data via HTTP.

`/fake` is fake data registration endpoint.

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

`/query` and `/graphql` is the GraphQL query endpoint.

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

## Limitations

Declarative Fake is a static fake, so it has the following limitations.

### Enum

`@newmo/graphql-fake-core` always returns the first value of the enum type.

```graphql
enum Status {
  ACTIVE
  INACTIVE
}
type User {
  status: Status!
}
```

Return the following response:

```json
{
  "data": {
    "user": {
      "status": "ACTIVE"
    }
  }
}
```

If you want to return a different value, you need to use `@exampleString` directive.

```graphql
enum Status {
  ACTIVE
  INACTIVE
}
type User {
  status: Status! @exampleString(value: "INACTIVE")
}
```

Or, You can use Dynamic Fake to return a different value.

- [`@newmo/graphql-codegen-fake-server-client`](https://npmjs.com/package/@newmo/graphql-codegen-fake-server-client)

### `union` and `inteface`

`@newmo/graphql-fake-core` always returns the first type of the union type/interface type.

```graphql
type User {
  id: ID!
  name: String
}
type Suspended {
  reason: String
}
type IsBlocked {
  message: String
  blockedByUser: User
}
union UserResult = User | IsBlocked | Suspended
type Query {
  user: UserResult
}
```

Return the following response:

```json
{
  "data": {
    "user": {
      "id": "xxxx-xxxx-xxxx-xxxx",
      "name": "String"
    }
  }
}
```

The default response is first type `User` of the union type `UserResult`.

If you want to return a different type, you need to use Dynamic Fake via HTTP.

- [`@newmo/graphql-codegen-fake-server-client`](https://npmjs.com/package/@newmo/graphql-codegen-fake-server-client)

### Custom Scalar

You can use `@exampleScalar*` directive to define the default value of the custom scalar.

```graphql
scalar CustomScalar @exampleScalarString(value: "example")
type Query {
  customScalar: CustomScalar
}
```

Or, You can create a config file for `@newmo/graphql-fake-server` to define the default value of the custom scalar.

`fake-server.config.mjs`:
```js
/**
 * @type {import("@newmo/graphql-fake-server").FakeServerConfig}
 */
const config = {
  schemaFilePath: "graphql/schema.graphql",
  // Define the default value of the custom scalar.
  defaultValues: {
    CustomScalar: {
      Digit: "1",
      DateYYYYMMDD: "'2022-02-03'",
      ISODateTime: "new Date().toISOString()"
    }
  }
};
export default config;
```

Run the fake server with the config file.

```bash
$ npx @newmo/graphql-fake-server --config ./fake-server.config.mjs
```

If you want to know more about the CLI, please see [packages/@newmo/graphql-fake-server](packages/@newmo/graphql-fake-server/README.md)

### `operationName` is required

`@newmo/graphql-fake-server` depended on `operationName` of GraphQL requests.
The fake server manages the fakes using the `sequence-id` header and `operationName` value combination as keys.

As a result, the graphql request body should includes `operationName` value.

```js
const sequenceId = crypto.randomUUID();
const response = await fetch(`${urls.fakeServer}/graphql`, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "sequence-id": sequenceId,
    },
    body: JSON.stringify({
        operationName: "GetDog", // <= required
        query: `
            query GetDog {
                dog {
                    id
                    name
                }
            }
        `,
    }),
});
```

## FAQ

### Can I use example directives to `input` type?

Yes, It is allowed to use example directives to `input` type.

`@example*` directive is for defining fake data of response, but it is also useful for declaring example value of input.
`@newmo/graphql-fake-server` can not fake the request data, but you can use `@example*` directive to declare example value of input.

```graphql
input CreateDocumentInput {
  """
  This @exampleString directive does not affect the request for fake server
  It is like comment for the input field.
  """
  name: String! @exampleString(value: "new doc")
}
```

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
