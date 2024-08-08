export const EXAMPLE_DIRECTIVE = `
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
`;
export const extendSchema = (schema: string) => {
    return EXAMPLE_DIRECTIVE + schema;
};
