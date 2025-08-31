/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "query GetBooks {\n  books {\n    id\n    title\n  }\n}\n\nfragment BookFragmentParts on Book {\n  id\n  title\n}\n\nquery GetBookWithFragments($bookId: ID!) {\n  book(id: $bookId) {\n    ...BookFragmentParts\n  }\n}\n\nquery GetDog {\n  dog {\n    id\n    name\n  }\n}\n\nquery GotUnionUser {\n  unionUser {\n    ... on User {\n      id\n      name\n      birthDate\n      birthYYYYMM\n    }\n    ... on UserIsBlocked {\n      message\n      blockedByUser {\n        id\n        name\n      }\n    }\n  }\n}\n\nquery GetUserNamesArrayExample {\n  userNamesArray {\n    names\n  }\n}\n\nmutation CreateBook($title: String!) {\n  createBook(input: {title: $title}) {\n    id\n    title\n  }\n}\n\nmutation CreateBookInline($title: String!) {\n  createBookInline(bookId: 1, bookTitle: $title) {\n    id\n    title\n  }\n}\n\nmutation UseMutationErrorPatternMutation {\n  useMutationErrorPattern(input: {id: \"x\"}) {\n    errors {\n      ... on GeneralError {\n        message\n      }\n      ... on AbcError {\n        message\n        code\n        localizedMessage\n      }\n      ... on DisplayableError {\n        localizedMessage\n        message\n      }\n      ... on Error {\n        message\n      }\n    }\n  }\n}\n\nmutation CreateFooURL($input: FooURLInput!) {\n  createFooURL(input: $input) {\n    URL\n    errors {\n      ... on CreateFooURLErrorDetail {\n        code\n        message\n      }\n    }\n  }\n}": typeof types.GetBooksDocument,
};
const documents: Documents = {
    "query GetBooks {\n  books {\n    id\n    title\n  }\n}\n\nfragment BookFragmentParts on Book {\n  id\n  title\n}\n\nquery GetBookWithFragments($bookId: ID!) {\n  book(id: $bookId) {\n    ...BookFragmentParts\n  }\n}\n\nquery GetDog {\n  dog {\n    id\n    name\n  }\n}\n\nquery GotUnionUser {\n  unionUser {\n    ... on User {\n      id\n      name\n      birthDate\n      birthYYYYMM\n    }\n    ... on UserIsBlocked {\n      message\n      blockedByUser {\n        id\n        name\n      }\n    }\n  }\n}\n\nquery GetUserNamesArrayExample {\n  userNamesArray {\n    names\n  }\n}\n\nmutation CreateBook($title: String!) {\n  createBook(input: {title: $title}) {\n    id\n    title\n  }\n}\n\nmutation CreateBookInline($title: String!) {\n  createBookInline(bookId: 1, bookTitle: $title) {\n    id\n    title\n  }\n}\n\nmutation UseMutationErrorPatternMutation {\n  useMutationErrorPattern(input: {id: \"x\"}) {\n    errors {\n      ... on GeneralError {\n        message\n      }\n      ... on AbcError {\n        message\n        code\n        localizedMessage\n      }\n      ... on DisplayableError {\n        localizedMessage\n        message\n      }\n      ... on Error {\n        message\n      }\n    }\n  }\n}\n\nmutation CreateFooURL($input: FooURLInput!) {\n  createFooURL(input: $input) {\n    URL\n    errors {\n      ... on CreateFooURLErrorDetail {\n        code\n        message\n      }\n    }\n  }\n}": types.GetBooksDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GetBooks {\n  books {\n    id\n    title\n  }\n}\n\nfragment BookFragmentParts on Book {\n  id\n  title\n}\n\nquery GetBookWithFragments($bookId: ID!) {\n  book(id: $bookId) {\n    ...BookFragmentParts\n  }\n}\n\nquery GetDog {\n  dog {\n    id\n    name\n  }\n}\n\nquery GotUnionUser {\n  unionUser {\n    ... on User {\n      id\n      name\n      birthDate\n      birthYYYYMM\n    }\n    ... on UserIsBlocked {\n      message\n      blockedByUser {\n        id\n        name\n      }\n    }\n  }\n}\n\nquery GetUserNamesArrayExample {\n  userNamesArray {\n    names\n  }\n}\n\nmutation CreateBook($title: String!) {\n  createBook(input: {title: $title}) {\n    id\n    title\n  }\n}\n\nmutation CreateBookInline($title: String!) {\n  createBookInline(bookId: 1, bookTitle: $title) {\n    id\n    title\n  }\n}\n\nmutation UseMutationErrorPatternMutation {\n  useMutationErrorPattern(input: {id: \"x\"}) {\n    errors {\n      ... on GeneralError {\n        message\n      }\n      ... on AbcError {\n        message\n        code\n        localizedMessage\n      }\n      ... on DisplayableError {\n        localizedMessage\n        message\n      }\n      ... on Error {\n        message\n      }\n    }\n  }\n}\n\nmutation CreateFooURL($input: FooURLInput!) {\n  createFooURL(input: $input) {\n    URL\n    errors {\n      ... on CreateFooURLErrorDetail {\n        code\n        message\n      }\n    }\n  }\n}"): (typeof documents)["query GetBooks {\n  books {\n    id\n    title\n  }\n}\n\nfragment BookFragmentParts on Book {\n  id\n  title\n}\n\nquery GetBookWithFragments($bookId: ID!) {\n  book(id: $bookId) {\n    ...BookFragmentParts\n  }\n}\n\nquery GetDog {\n  dog {\n    id\n    name\n  }\n}\n\nquery GotUnionUser {\n  unionUser {\n    ... on User {\n      id\n      name\n      birthDate\n      birthYYYYMM\n    }\n    ... on UserIsBlocked {\n      message\n      blockedByUser {\n        id\n        name\n      }\n    }\n  }\n}\n\nquery GetUserNamesArrayExample {\n  userNamesArray {\n    names\n  }\n}\n\nmutation CreateBook($title: String!) {\n  createBook(input: {title: $title}) {\n    id\n    title\n  }\n}\n\nmutation CreateBookInline($title: String!) {\n  createBookInline(bookId: 1, bookTitle: $title) {\n    id\n    title\n  }\n}\n\nmutation UseMutationErrorPatternMutation {\n  useMutationErrorPattern(input: {id: \"x\"}) {\n    errors {\n      ... on GeneralError {\n        message\n      }\n      ... on AbcError {\n        message\n        code\n        localizedMessage\n      }\n      ... on DisplayableError {\n        localizedMessage\n        message\n      }\n      ... on Error {\n        message\n      }\n    }\n  }\n}\n\nmutation CreateFooURL($input: FooURLInput!) {\n  createFooURL(input: $input) {\n    URL\n    errors {\n      ... on CreateFooURLErrorDetail {\n        code\n        message\n      }\n    }\n  }\n}"];

export function graphql(source: string) {
    return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<infer TType, any> ? TType : never;
