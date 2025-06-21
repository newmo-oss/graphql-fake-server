import type { CodegenPlugin } from "@graphql-codegen/plugin-helpers";
import { normalizeConfig, type RawPluginConfig } from "./config";
import { convertName } from "./convertName";

const plugin: CodegenPlugin<RawPluginConfig> = {
    plugin(_schema, documents, rawConfig, _info) {
        const config = normalizeConfig(rawConfig);
        const _fakeEndpoint = config.fakeServerEndpoint;
        const registerOperationResponseType = "{ ok: true } | { ok: false; errors: string[] }";

        // New registration strategy - align with server implementation
        const conditionRuleTypes = `
export type FakeClientVariablesConditionRule<TVariables = Record<string, any>> = { type: "variables"; value: TVariables };
export type FakeClientConditionRule<TVariables = Record<string, any>> = FakeClientVariablesConditionRule<TVariables>;

// Single response registration
export type FakeClientRegisterSingleResponse = {
    type: "single";
    operationName: string;
    data: Record<string, unknown>;
};

// Array-based sequence response registration  
export type FakeClientRegisterSequenceResponse = {
    type: "sequence";
    operationName: string;
    data: Record<string, unknown>[];
};

// Conditional response registration
export type FakeClientRegisterConditionalResponse<TVariables = Record<string, any>> = {
    type: "conditional";
    operationName: string;
    conditions: Array<{
        condition: FakeClientConditionRule<TVariables>;
        data: Record<string, unknown> | Record<string, unknown>[];
    }>;
};

// Network error registration
export type FakeClientRegisterNetworkError = {
    type: "network-error";
    operationName: string;
    responseStatusCode: number;
    errors: Record<string, unknown>[];
};

export type FakeClientRegisterSequenceOptions<TVariables = Record<string, any>> = 
    | FakeClientRegisterSingleResponse 
    | FakeClientRegisterSequenceResponse 
    | FakeClientRegisterConditionalResponse<TVariables> 
    | FakeClientRegisterNetworkError;`;
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
                    generateRegisterSingleQueryMethod(fn.name, "options.fakeServerEndpoint"),
                ),
                indentEachLine(
                    `${indent}${indent}`,
                    generateRegisterSequenceQueryMethod(fn.name, "options.fakeServerEndpoint"),
                ),
                indentEachLine(
                    `${indent}${indent}`,
                    generateRegisterConditionalQueryMethod(fn.name, "options.fakeServerEndpoint"),
                ),
                indentEachLine(
                    `${indent}${indent}`,
                    generateRegisterQueryErrorMethod(fn.name, "options.fakeServerEndpoint"),
                ),
                indentEachLine(
                    `${indent}${indent}`,
                    generateCalledQuery(fn.name, `options.fakeServerEndpoint + "/called"`),
                ),
            ];
        }
        if (fn.type === "mutation") {
            return [
                indentEachLine(
                    `${indent}${indent}`,
                    generateRegisterSingleMutationMethod(fn.name, "options.fakeServerEndpoint"),
                ),
                indentEachLine(
                    `${indent}${indent}`,
                    generateRegisterSequenceMutationMethod(fn.name, "options.fakeServerEndpoint"),
                ),
                indentEachLine(
                    `${indent}${indent}`,
                    generateRegisterConditionalMutationMethod(
                        fn.name,
                        "options.fakeServerEndpoint",
                    ),
                ),
                indentEachLine(
                    `${indent}${indent}`,
                    generateRegisterMutationErrorMethod(fn.name, "options.fakeServerEndpoint"),
                ),
                indentEachLine(
                    `${indent}${indent}`,
                    generateCalledMutation(fn.name, `options.fakeServerEndpoint + "/called"`),
                ),
            ];
        }
        throw new Error(`Unknown type${fn}`);
    })
    .join(",\n")}
  };
}`;
        };

        // Single response registration for Query
        const generateRegisterSingleQueryMethod = (
            name: string,
            fakeEndpointVariableName: string,
        ) => {
            return `async register${name}QuerySingleResponse(sequenceId: string, queryResponse: ${name}Query): Promise<${registerOperationResponseType}> {
    return await fetch(${fakeEndpointVariableName}, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'sequence-id': sequenceId
        },
        body: JSON.stringify({
            type: "single",
            operationName: "${name}",
            data: queryResponse
        }),
    }).then((res) => res.json()) as ${registerOperationResponseType};
}`;
        };

        // Array-based sequence registration for Query
        const generateRegisterSequenceQueryMethod = (
            name: string,
            fakeEndpointVariableName: string,
        ) => {
            return `async register${name}QuerySequenceResponse(sequenceId: string, queryResponses: ${name}Query[]): Promise<${registerOperationResponseType}> {
    return await fetch(${fakeEndpointVariableName}, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'sequence-id': sequenceId
        },
        body: JSON.stringify({
            type: "sequence",
            operationName: "${name}",
            data: queryResponses
        }),
    }).then((res) => res.json()) as ${registerOperationResponseType};
}`;
        };

        // Conditional response registration for Query
        const generateRegisterConditionalQueryMethod = (
            name: string,
            fakeEndpointVariableName: string,
        ) => {
            const variablesType = `${convertName(name, config)}QueryVariables`;
            return `async register${name}QueryConditionalResponse(sequenceId: string, conditions: Array<{ condition: FakeClientConditionRule<${variablesType}>; data: ${name}Query | ${name}Query[] }>): Promise<${registerOperationResponseType}> {
    return await fetch(${fakeEndpointVariableName}, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'sequence-id': sequenceId
        },
        body: JSON.stringify({
            type: "conditional",
            operationName: "${name}",
            conditions: conditions
        }),
    }).then((res) => res.json()) as ${registerOperationResponseType};
}`;
        };

        // Network error registration for Query
        const generateRegisterQueryErrorMethod = (
            name: string,
            fakeEndpointVariableName: string,
        ) => {
            return `async register${name}QueryErrorResponse(sequenceId: string, { errors, responseStatusCode }: { errors: Record<string, unknown>[]; responseStatusCode: number }): Promise<${registerOperationResponseType}> {
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

        // Single response registration for Mutation
        const generateRegisterSingleMutationMethod = (
            name: string,
            fakeEndpointVariableName: string,
        ) => {
            return `async register${name}MutationSingleResponse(sequenceId: string, mutationResponse: ${name}Mutation): Promise<${registerOperationResponseType}> {
    return await fetch(${fakeEndpointVariableName}, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'sequence-id': sequenceId
        },
        body: JSON.stringify({
            type: "single",
            operationName: "${name}",
            data: mutationResponse
        }),
    }).then((res) => res.json()) as ${registerOperationResponseType};
}`;
        };

        // Array-based sequence registration for Mutation
        const generateRegisterSequenceMutationMethod = (
            name: string,
            fakeEndpointVariableName: string,
        ) => {
            return `async register${name}MutationSequenceResponse(sequenceId: string, mutationResponses: ${name}Mutation[]): Promise<${registerOperationResponseType}> {
    return await fetch(${fakeEndpointVariableName}, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'sequence-id': sequenceId
        },
        body: JSON.stringify({
            type: "sequence",
            operationName: "${name}",
            data: mutationResponses
        }),
    }).then((res) => res.json()) as ${registerOperationResponseType};
}`;
        };

        // Conditional response registration for Mutation
        const generateRegisterConditionalMutationMethod = (
            name: string,
            fakeEndpointVariableName: string,
        ) => {
            const variablesType = `${convertName(name, config)}MutationVariables`;
            return `async register${name}MutationConditionalResponse(sequenceId: string, conditions: Array<{ condition: FakeClientConditionRule<${variablesType}>; data: ${name}Mutation | ${name}Mutation[] }>): Promise<${registerOperationResponseType}> {
    return await fetch(${fakeEndpointVariableName}, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'sequence-id': sequenceId
        },
        body: JSON.stringify({
            type: "conditional",
            operationName: "${name}",
            conditions: conditions
        }),
    }).then((res) => res.json()) as ${registerOperationResponseType};
}`;
        };

        // Network error registration for Mutation
        const generateRegisterMutationErrorMethod = (
            name: string,
            fakeEndpointVariableName: string,
        ) => {
            return `async register${name}MutationErrorResponse(sequenceId: string, { errors, responseStatusCode }: { errors: Record<string, unknown>[]; responseStatusCode: number }): Promise<${registerOperationResponseType}> {
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
        const generateCalledQuery = (name: string, calledEndpoint: string) => {
            return `async called${name}Query(sequenceId:string): Promise<{
  ok: true;
  data: {
    requestTimestamp: number;
    request: {
      headers: Record<string, unknown>;
      body: {
        operationName: string;
        query: string;
      };
    };
    response: {
        statusCode: number;
        headers: Record<string, unknown>;
        body: ${convertName(name, config)}Query;
    };
  }[]            
}> {
    return await fetch(${calledEndpoint}, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'sequence-id': sequenceId
        },
        body: JSON.stringify({
            operationName: "${name}"
        }),
    }).then((res) => res.json()) as {
  ok: true;
  data: {
    requestTimestamp: number;
    request: {
      headers: Record<string, unknown>;
      body: {
        operationName: string;
        query: string;
      };
    };
    response: {
        statusCode: number;
        headers: Record<string, unknown>;
        body: ${convertName(name, config)}Query;
    };
  }[];
};
}`;
        };

        const generateCalledMutation = (name: string, calledEndpoint: string) => {
            return `async called${name}Mutation(sequenceId:string): Promise<{
  ok: true;
  data: {
    requestTimestamp: number;
    request: {
      headers: Record<string, unknown>;
      body: {
        operationName: string;
        query: string;
        variables: ${convertName(name, config)}MutationVariables;
      };
    };
    response: {
        statusCode: number;
        headers: Record<string, unknown>;
        body: ${convertName(name, config)}Mutation;
    };
  }[];
}> {
    return await fetch(${calledEndpoint}, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'sequence-id': sequenceId
        },
        body: JSON.stringify({
            operationName: "${name}"
        }),
    }).then((res) => res.json()) as {
  ok: true;
  data: {
    requestTimestamp: number;
    request: {
      headers: Record<string, unknown>;
      body: {
        operationName: string;
        query: string;
        variables: ${convertName(name, config)}MutationVariables;
      };
    };
    response: {
        statusCode: number;
        headers: Record<string, unknown>;
        body: ${convertName(name, config)}Mutation;
    };
  }[];
}
}`;
        };

        const importQueryIdentifierName = (documentName: string) => {
            return `import type { ${convertName(
                documentName,
                config,
            )}Query, ${convertName(documentName, config)}QueryVariables } from '${config.typesFile}';`;
        };
        const importMutationIdentifierName = (documentName: string) => {
            return `import type { ${convertName(documentName, config)}Mutation, ${convertName(
                documentName,
                config,
            )}MutationVariables } from '${config.typesFile}';`;
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
${conditionRuleTypes}
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
