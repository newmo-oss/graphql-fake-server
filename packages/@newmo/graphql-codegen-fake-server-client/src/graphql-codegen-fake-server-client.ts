import type { CodegenPlugin } from "@graphql-codegen/plugin-helpers";
import { type RawPluginConfig, normalizeConfig } from "./config";
import { convertName } from "./convertName";

const plugin: CodegenPlugin<RawPluginConfig> = {
    plugin(schema, documents, rawConfig, _info) {
        const config = normalizeConfig(rawConfig);
        const fakeEndpoint = config.fakeServerEndpoint;
        const registerOperationResponseType = "{ ok: true } | { ok: false; errors: string[] }";
        type GenerateFakeFunction =
            | {
                  type: "query";
                  name: string;
              }
            | {
                  type: "mutation";
                  name: string;
              };
        const indentEachLine = (indent: string, text: string) => {
            return text
                .split("\n")
                .map((line) => `${indent}${line}`)
                .join("\n");
        };
        const generateFakeClient = (exportsFunctions: GenerateFakeFunction[]) => {
            const indent = "  ";
            return `\
export type CreateFakeClientOptions = {
  /** 
   * The URL of the fake server
   * @example 'http://localhost:4000/fake'
   */
  fakeServerEndpoint: string;
};
export function createFakeClient(options: CreateFakeClientOptions) {
  if(!options.fakeServerEndpoint.endsWith('/fake')) {
    throw new Error('fakeServerEndpoint must end with "/fake"');
  }
  return {
${exportsFunctions
    .flatMap((fn) => {
        if (fn.type === "query") {
            return [
                indentEachLine(
                    `${indent}${indent}`,
                    generateRegisterOperationMethod(fn.name, "options.fakeServerEndpoint"),
                ),
                indentEachLine(
                    `${indent}${indent}`,
                    generateRegisterOperationErrorMethod(fn.name, "options.fakeServerEndpoint"),
                ),
            ];
        }
        if (fn.type === "mutation") {
            return [
                indentEachLine(
                    `${indent}${indent}`,
                    generateRegisterMutationMethod(fn.name, "options.fakeServerEndpoint"),
                ),
                indentEachLine(
                    `${indent}${indent}`,
                    generateRegisterMutationErrorMethod(fn.name, "options.fakeServerEndpoint"),
                ),
            ];
        }
        throw new Error(`Unknown type${fn}`);
    })
    .join(",\n")}
  };
}`;
        };
        const generateRegisterOperationMethod = (
            name: string,
            fakeEndpointVariableName: string,
        ) => {
            return `async register${name}QueryResponse(sequenceId:string, queryResponse: ${name}Query): Promise<${registerOperationResponseType}> {
    return await fetch(${fakeEndpointVariableName}, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'sequence-id': sequenceId
        },
        body: JSON.stringify({
            type: "operation",
            operationName: "${name}",
            data: queryResponse
        }),
    }).then((res) => res.json()) as ${registerOperationResponseType};
}`;
        };
        const generateRegisterOperationErrorMethod = (
            name: string,
            fakeEndpointVariableName: string,
        ) => {
            return `async register${name}QueryErrorResponse(sequenceId:string, { errors, responseStatusCode }: { errors: Record<string, unknown>[]; responseStatusCode: number }): Promise<${registerOperationResponseType}> {
    return await fetch(${fakeEndpointVariableName}, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'sequence-id': sequenceId
        },
        body: JSON.stringify({
            type: "network-error",
            operationName: "${name}",
            responseStatusCode,
            errors
        }),
    }).then((res) => res.json()) as ${registerOperationResponseType};
}`;
        };
        const generateRegisterMutationMethod = (name: string, fakeEndpointVariableName: string) => {
            return `async register${name}MutationResponse(sequenceId:string, mutationResponse: ${name}Mutation): Promise<${registerOperationResponseType}> {
    return await fetch(${fakeEndpointVariableName}, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'sequence-id': sequenceId
        },
        body: JSON.stringify({
            type: "operation",
            operationName: "${name}",
            data: mutationResponse
        }),
    }).then((res) => res.json()) as ${registerOperationResponseType};
}`;
        };
        const generateRegisterMutationErrorMethod = (
            name: string,
            fakeEndpointVariableName: string,
        ) => {
            return `async register${name}MutationErrorResponse(sequenceId:string, { errors, responseStatusCode }: { errors: Record<string, unknown>[]; responseStatusCode: number }): Promise<${registerOperationResponseType}> {
    return await fetch(${fakeEndpointVariableName}, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'sequence-id': sequenceId
        },
        body: JSON.stringify({
            type: "network-error",
            operationName: "${name}",
            responseStatusCode,
            errors
        }),
    }).then((res) => res.json()) as ${registerOperationResponseType};
}`;
        };
        const importQueryIdentifierName = (documentName: string) => {
            return `import type { ${convertName(documentName, config)}Query } from '${
                config.typesFile
            }';`;
        };
        const importMutationIdentifierName = (documentName: string) => {
            return `import type { ${convertName(documentName, config)}Mutation } from '${
                config.typesFile
            }';`;
        };
        return `/* eslint-disable */
// This file was generated by a @newmo/graphql-codegen-fake-server-operation
${documents
    .flatMap((document) => {
        return document.document?.definitions?.map((definition) => {
            // query
            if (
                definition.kind === "OperationDefinition" &&
                definition.operation === "query" &&
                definition.name
            ) {
                return importQueryIdentifierName(definition.name.value);
            }
            if (
                definition.kind === "OperationDefinition" &&
                definition.operation === "mutation" &&
                definition.name
            ) {
                return importMutationIdentifierName(definition.name.value);
            }
            return [];
        });
    })
    .join("\n")}
${generateFakeClient(
    documents.flatMap((document) => {
        const flatMap =
            document.document?.definitions?.flatMap((definition) => {
                if (
                    definition.kind === "OperationDefinition" &&
                    definition.operation === "query" &&
                    definition.name
                ) {
                    return [
                        {
                            name: convertName(definition.name.value, config),
                            type: "query",
                        },
                    ] satisfies GenerateFakeFunction[] as GenerateFakeFunction[];
                }
                if (
                    definition.kind === "OperationDefinition" &&
                    definition.operation === "mutation" &&
                    definition.name
                ) {
                    return [
                        {
                            name: convertName(definition.name.value, config),
                            type: "mutation",
                        },
                    ] satisfies GenerateFakeFunction[] as GenerateFakeFunction[];
                }
                return [];
            }) ?? [];
        return flatMap satisfies GenerateFakeFunction[] as GenerateFakeFunction[];
    }),
)}
`;
    },
};
// GraphQL Codegen Plugin requires CommonJS export
module.exports = plugin;
