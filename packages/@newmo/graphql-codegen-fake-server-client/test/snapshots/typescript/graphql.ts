/* eslint-disable */
import { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core";
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T
> = { [_ in K]?: never };
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never;
    };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
};

export type CreateFooUrlError = CreateFooUrlErrorDetail;

export enum CreateFooUrlErrorCode {
  FailedToCreateFooUrl = "FAILED_TO_CREATE_FOO_URL",
}

export type CreateFooUrlErrorDetail = Error & {
  __typename?: "CreateFooURLErrorDetail";
  code: CreateFooUrlErrorCode;
  message: Scalars["String"]["output"];
};

export type Destination = {
  __typename?: "Destination";
  /** Destination ID */
  id: Scalars["ID"]["output"];
  /** Destination name */
  name: Scalars["String"]["output"];
};

export type Error = {
  message: Scalars["String"]["output"];
};

export type FooUrlInput = {
  /** Foo URL */
  URL: Scalars["String"]["input"];
};

export type FooUrlPayload = {
  __typename?: "FooURLPayload";
  /** Foo URL */
  URL: Scalars["String"]["output"];
  /** Errors */
  errors: Array<CreateFooUrlError>;
};

export type FooUrlResource = {
  __typename?: "FooURLResource";
  /** Foo URL */
  URL: Scalars["String"]["output"];
};

export type Mutation = {
  __typename?: "Mutation";
  /** Create Foo URL */
  createFooURL: FooUrlPayload;
  /** Create Ride History */
  createURLRideHistory: RideHistory;
};

export type MutationCreateFooUrlArgs = {
  input: FooUrlInput;
};

export type MutationCreateUrlRideHistoryArgs = {
  input: RideHistoryInput;
};

export type Query = {
  __typename?: "Query";
  /** Destination candidates that match the search string */
  destinationCandidates: Array<Destination>;
  /** Ride history */
  rideHistories: Array<RideHistory>;
};

export type QueryDestinationCandidatesArgs = {
  text: Scalars["String"]["input"];
};

export type RideHistory = {
  __typename?: "RideHistory";
  /** Destination */
  destination: Destination;
  /** Ride History ID */
  id: Scalars["ID"]["output"];
  /** Destination Name */
  name: Scalars["String"]["output"];
};

export type RideHistoryInput = {
  /** Destination name */
  name: Scalars["String"]["input"];
};

export type ListDestinationCandidatesQueryVariables = Exact<{
  text: Scalars["String"]["input"];
}>;

export type ListDestinationCandidatesQuery = {
  __typename?: "Query";
  destinationCandidates: Array<{
    __typename?: "Destination";
    id: string;
    name: string;
  }>;
};

export type ListRideHistoriesQueryVariables = Exact<{ [key: string]: never }>;

export type ListRideHistoriesQuery = {
  __typename?: "Query";
  rideHistories: Array<{
    __typename?: "RideHistory";
    id: string;
    destination: { __typename?: "Destination"; id: string; name: string };
  }>;
};

export type CreateUrlRideHistoryMutationVariables = Exact<{
  desinationName: Scalars["String"]["input"];
}>;

export type CreateUrlRideHistoryMutation = {
  __typename?: "Mutation";
  createURLRideHistory: {
    __typename?: "RideHistory";
    id: string;
    name: string;
  };
};

export type CreateFooUrlRideHistoryMutationVariables = Exact<{
  desinationName: Scalars["String"]["input"];
}>;

export type CreateFooUrlRideHistoryMutation = {
  __typename?: "Mutation";
  createURLRideHistory: {
    __typename?: "RideHistory";
    id: string;
    name: string;
  };
};

export const ListDestinationCandidatesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "ListDestinationCandidates" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "text" } },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "destinationCandidates" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "text" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "text" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  ListDestinationCandidatesQuery,
  ListDestinationCandidatesQueryVariables
>;
export const ListRideHistoriesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "ListRideHistories" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "rideHistories" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "destination" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  ListRideHistoriesQuery,
  ListRideHistoriesQueryVariables
>;
export const CreateUrlRideHistoryDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "CreateURLRideHistory" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "desinationName" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "createURLRideHistory" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "ObjectValue",
                  fields: [
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "name" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "desinationName" },
                      },
                    },
                  ],
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CreateUrlRideHistoryMutation,
  CreateUrlRideHistoryMutationVariables
>;
export const CreateFooUrlRideHistoryDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "CreateFooURLRideHistory" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "desinationName" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "createURLRideHistory" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "ObjectValue",
                  fields: [
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "name" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "desinationName" },
                      },
                    },
                  ],
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CreateFooUrlRideHistoryMutation,
  CreateFooUrlRideHistoryMutationVariables
>;
