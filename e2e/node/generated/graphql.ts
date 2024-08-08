/* eslint-disable */
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  DATE_YYYMM: { input: any; output: any; }
  DATE_YYYYMMDD: { input: any; output: any; }
};

export type AbcError = DisplayableError & Error & {
  __typename?: 'AbcError';
  code: AbcErrorCode;
  localizedMessage: Scalars['String']['output'];
  message: Scalars['String']['output'];
};

export enum AbcErrorCode {
  AlreadyExist = 'ALREADY_EXIST',
  Invalid = 'INVALID'
}

export type Author = {
  __typename?: 'Author';
  age: Scalars['Int']['output'];
  books: Array<Book>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type Book = {
  __typename?: 'Book';
  author: Author;
  genre: BookGenre;
  genre_non_example: BookGenre;
  id: Scalars['ID']['output'];
  title: Scalars['String']['output'];
};

/** You Schema definition goes here */
export enum BookGenre {
  Fiction = 'FICTION',
  NonFiction = 'NON_FICTION'
}

export type Character = {
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type CreateBookInput = {
  title: Scalars['String']['input'];
};

export type CreateFooUrlError = CreateFooUrlErrorDetail;

export enum CreateFooUrlErrorCode {
  FailedToCreateFooUrl = 'FAILED_TO_CREATE_FOO_URL'
}

export type CreateFooUrlErrorDetail = Error & {
  __typename?: 'CreateFooURLErrorDetail';
  code: CreateFooUrlErrorCode;
  message: Scalars['String']['output'];
};

export type DisplayableError = {
  code: AbcErrorCode;
  localizedMessage: Scalars['String']['output'];
  message: Scalars['String']['output'];
};

export type Dog = Character & {
  __typename?: 'Dog';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  nickname: Scalars['String']['output'];
};

export type Error = {
  message: Scalars['String']['output'];
};

export type FooUrlInput = {
  /** Foo URL */
  URL: Scalars['String']['input'];
};

export type FooUrlPayload = {
  __typename?: 'FooURLPayload';
  /** Foo URL */
  URL: Scalars['String']['output'];
  /** Errors */
  errors: Array<CreateFooUrlError>;
};

export type FooUrlResource = {
  __typename?: 'FooURLResource';
  /** Foo URL */
  URL: Scalars['String']['output'];
};

export type GeneralError = Error & {
  __typename?: 'GeneralError';
  message: Scalars['String']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  createBook: Book;
  createBookInline: Book;
  createFooURL: FooUrlPayload;
  useMutationErrorPattern: UseMutationErrorPatternPayload;
};


export type MutationCreateBookArgs = {
  input: CreateBookInput;
};


export type MutationCreateBookInlineArgs = {
  bookId: Scalars['ID']['input'];
  bookTitle: Scalars['String']['input'];
};


export type MutationCreateFooUrlArgs = {
  input: FooUrlInput;
};


export type MutationUseMutationErrorPatternArgs = {
  input: UseMutationErrorPatternInput;
};

export type MutationErrorPattern = {
  __typename?: 'MutationErrorPattern';
  id: Scalars['ID']['output'];
  name?: Maybe<Scalars['String']['output']>;
};

export type Query = {
  __typename?: 'Query';
  author?: Maybe<Author>;
  authors: Array<Author>;
  book?: Maybe<Book>;
  books: Array<Book>;
  dog: Dog;
  unionUser?: Maybe<UnionUserResult>;
  userNamesArray: UserNamesArrayExample;
  userWithErrors?: Maybe<UserWithErrors>;
};


export type QueryAuthorArgs = {
  id: Scalars['ID']['input'];
};


export type QueryBookArgs = {
  id: Scalars['ID']['input'];
};

export type UnionUserResult = User | UserIsBlocked | UserSuspended;

export type UseMutationErrorPatternError = AbcError | GeneralError;

export type UseMutationErrorPatternInput = {
  id: Scalars['String']['input'];
};

export type UseMutationErrorPatternPayload = {
  __typename?: 'UseMutationErrorPatternPayload';
  MutationErrorPattern?: Maybe<MutationErrorPattern>;
  errors: Array<UseMutationErrorPatternError>;
};

export type User = {
  __typename?: 'User';
  birthDate?: Maybe<Scalars['DATE_YYYYMMDD']['output']>;
  birthYYYYMM?: Maybe<Scalars['DATE_YYYMM']['output']>;
  id: Scalars['ID']['output'];
  name?: Maybe<Scalars['String']['output']>;
};

export type UserIsBlocked = {
  __typename?: 'UserIsBlocked';
  blockedByUser?: Maybe<User>;
  message?: Maybe<Scalars['String']['output']>;
};

export type UserNamesArrayExample = {
  __typename?: 'UserNamesArrayExample';
  names: Array<Scalars['String']['output']>;
};

export type UserSuspended = {
  __typename?: 'UserSuspended';
  reason?: Maybe<Scalars['String']['output']>;
};

export type UserWithErrors = {
  __typename?: 'UserWithErrors';
  errors: Array<GeneralError>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type GetBooksQueryVariables = Exact<{ [key: string]: never; }>;


export type GetBooksQuery = { __typename?: 'Query', books: Array<{ __typename?: 'Book', id: string, title: string }> };

export type BookFragmentPartsFragment = { __typename?: 'Book', id: string, title: string } & { ' $fragmentName'?: 'BookFragmentPartsFragment' };

export type GetBookWithFragmentsQueryVariables = Exact<{
  bookId: Scalars['ID']['input'];
}>;


export type GetBookWithFragmentsQuery = { __typename?: 'Query', book?: (
    { __typename?: 'Book' }
    & { ' $fragmentRefs'?: { 'BookFragmentPartsFragment': BookFragmentPartsFragment } }
  ) | null };

export type GetDogQueryVariables = Exact<{ [key: string]: never; }>;


export type GetDogQuery = { __typename?: 'Query', dog: { __typename?: 'Dog', id: string, name: string } };

export type GotUnionUserQueryVariables = Exact<{ [key: string]: never; }>;


export type GotUnionUserQuery = { __typename?: 'Query', unionUser?: { __typename?: 'User', id: string, name?: string | null, birthDate?: any | null, birthYYYYMM?: any | null } | { __typename?: 'UserIsBlocked', message?: string | null, blockedByUser?: { __typename?: 'User', id: string, name?: string | null } | null } | { __typename?: 'UserSuspended' } | null };

export type GetUserNamesArrayExampleQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUserNamesArrayExampleQuery = { __typename?: 'Query', userNamesArray: { __typename?: 'UserNamesArrayExample', names: Array<string> } };

export type CreateBookMutationVariables = Exact<{
  title: Scalars['String']['input'];
}>;


export type CreateBookMutation = { __typename?: 'Mutation', createBook: { __typename?: 'Book', id: string, title: string } };

export type CreateBookInlineMutationVariables = Exact<{
  title: Scalars['String']['input'];
}>;


export type CreateBookInlineMutation = { __typename?: 'Mutation', createBookInline: { __typename?: 'Book', id: string, title: string } };

export type UseMutationErrorPatternMutationMutationVariables = Exact<{ [key: string]: never; }>;


export type UseMutationErrorPatternMutationMutation = { __typename?: 'Mutation', useMutationErrorPattern: { __typename?: 'UseMutationErrorPatternPayload', errors: Array<{ __typename?: 'AbcError', message: string, code: AbcErrorCode, localizedMessage: string } | { __typename?: 'GeneralError', message: string }> } };

export type CreateFooUrlMutationVariables = Exact<{
  input: FooUrlInput;
}>;


export type CreateFooUrlMutation = { __typename?: 'Mutation', createFooURL: { __typename?: 'FooURLPayload', URL: string, errors: Array<{ __typename?: 'CreateFooURLErrorDetail', code: CreateFooUrlErrorCode, message: string }> } };

export const BookFragmentPartsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BookFragmentParts"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Book"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]} as unknown as DocumentNode<BookFragmentPartsFragment, unknown>;
export const GetBooksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetBooks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"books"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]} as unknown as DocumentNode<GetBooksQuery, GetBooksQueryVariables>;
export const GetBookWithFragmentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetBookWithFragments"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"bookId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"book"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"bookId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BookFragmentParts"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BookFragmentParts"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Book"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]} as unknown as DocumentNode<GetBookWithFragmentsQuery, GetBookWithFragmentsQueryVariables>;
export const GetDogDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetDog"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dog"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<GetDogQuery, GetDogQueryVariables>;
export const GotUnionUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GotUnionUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unionUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"birthYYYYMM"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserIsBlocked"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"blockedByUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GotUnionUserQuery, GotUnionUserQueryVariables>;
export const GetUserNamesArrayExampleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserNamesArrayExample"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userNamesArray"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"names"}}]}}]}}]} as unknown as DocumentNode<GetUserNamesArrayExampleQuery, GetUserNamesArrayExampleQueryVariables>;
export const CreateBookDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateBook"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"title"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createBook"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"title"},"value":{"kind":"Variable","name":{"kind":"Name","value":"title"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]} as unknown as DocumentNode<CreateBookMutation, CreateBookMutationVariables>;
export const CreateBookInlineDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateBookInline"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"title"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createBookInline"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"bookId"},"value":{"kind":"IntValue","value":"1"}},{"kind":"Argument","name":{"kind":"Name","value":"bookTitle"},"value":{"kind":"Variable","name":{"kind":"Name","value":"title"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]} as unknown as DocumentNode<CreateBookInlineMutation, CreateBookInlineMutationVariables>;
export const UseMutationErrorPatternMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UseMutationErrorPatternMutation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"useMutationErrorPattern"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"StringValue","value":"x","block":false}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GeneralError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AbcError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"localizedMessage"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DisplayableError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"localizedMessage"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Error"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]}}]} as unknown as DocumentNode<UseMutationErrorPatternMutationMutation, UseMutationErrorPatternMutationMutationVariables>;
export const CreateFooUrlDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateFooURL"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"FooURLInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createFooURL"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"URL"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CreateFooURLErrorDetail"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]}}]} as unknown as DocumentNode<CreateFooUrlMutation, CreateFooUrlMutationVariables>;