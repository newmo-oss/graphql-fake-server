/* eslint-disable */
import { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core";
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = {
    [_ in K]?: never;
};
export type Incremental<T> =
    | T
    | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
    ID: { input: string; output: string };
    String: { input: string; output: string };
    Boolean: { input: boolean; output: boolean };
    Int: { input: number; output: number };
    Float: { input: number; output: number };
};

export type Author = {
    __typename?: "Author";
    age: Scalars["Int"]["output"];
    books: Array<Book>;
    id: Scalars["ID"]["output"];
    name: Scalars["String"]["output"];
};

export type Book = {
    __typename?: "Book";
    author: Author;
    genre: BookGenre;
    id: Scalars["ID"]["output"];
    title: Scalars["String"]["output"];
};

export enum BookGenre {
    Fiction = "FICTION",
    NonFiction = "NON_FICTION",
}

export type CreateBookInput = {
    title: Scalars["String"]["input"];
};

export type Mutation = {
    __typename?: "Mutation";
    createBook: Book;
};

export type MutationCreateBookArgs = {
    input: CreateBookInput;
};

export type Query = {
    __typename?: "Query";
    author?: Maybe<Author>;
    authors: Array<Author>;
    book?: Maybe<Book>;
    books: Array<Book>;
};

export type QueryAuthorArgs = {
    id: Scalars["ID"]["input"];
};

export type QueryBookArgs = {
    id: Scalars["ID"]["input"];
};

export type GetBooksQueryVariables = Exact<{ [key: string]: never }>;

export type GetBooksQuery = {
    __typename?: "Query";
    books: Array<{ __typename?: "Book"; id: string; title: string }>;
};

export type CreateBookMutationVariables = Exact<{
    title: Scalars["String"]["input"];
}>;

export type CreateBookMutation = {
    __typename?: "Mutation";
    createBook: { __typename?: "Book"; id: string; title: string };
};

export const GetBooksDocument = {
    kind: "Document",
    definitions: [
        {
            kind: "OperationDefinition",
            operation: "query",
            name: { kind: "Name", value: "GetBooks" },
            selectionSet: {
                kind: "SelectionSet",
                selections: [
                    {
                        kind: "Field",
                        name: { kind: "Name", value: "books" },
                        selectionSet: {
                            kind: "SelectionSet",
                            selections: [
                                { kind: "Field", name: { kind: "Name", value: "id" } },
                                { kind: "Field", name: { kind: "Name", value: "title" } },
                            ],
                        },
                    },
                ],
            },
        },
    ],
} as unknown as DocumentNode<GetBooksQuery, GetBooksQueryVariables>;
export const CreateBookDocument = {
    kind: "Document",
    definitions: [
        {
            kind: "OperationDefinition",
            operation: "mutation",
            name: { kind: "Name", value: "CreateBook" },
            variableDefinitions: [
                {
                    kind: "VariableDefinition",
                    variable: { kind: "Variable", name: { kind: "Name", value: "title" } },
                    type: {
                        kind: "NonNullType",
                        type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
                    },
                },
            ],
            selectionSet: {
                kind: "SelectionSet",
                selections: [
                    {
                        kind: "Field",
                        name: { kind: "Name", value: "createBook" },
                        arguments: [
                            {
                                kind: "Argument",
                                name: { kind: "Name", value: "input" },
                                value: {
                                    kind: "ObjectValue",
                                    fields: [
                                        {
                                            kind: "ObjectField",
                                            name: { kind: "Name", value: "title" },
                                            value: {
                                                kind: "Variable",
                                                name: { kind: "Name", value: "title" },
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
                                { kind: "Field", name: { kind: "Name", value: "title" } },
                            ],
                        },
                    },
                ],
            },
        },
    ],
} as unknown as DocumentNode<CreateBookMutation, CreateBookMutationVariables>;
