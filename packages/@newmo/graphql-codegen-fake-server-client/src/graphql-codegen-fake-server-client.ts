import type { CodegenPlugin } from "@graphql-codegen/plugin-helpers";
import { normalizeConfig, type RawPluginConfig } from "./config";
import { convertName } from "./convertName";

const plugin: CodegenPlugin<RawPluginConfig> = {
    plugin(_schema, documents, rawConfig, _info) {
        const config = normalizeConfig(rawConfig);
        const _fakeEndpoint = config.fakeServerEndpoint;
        const registerOperationResponseType = "{ ok: true } | { ok: false; errors: string[] }"; // Conditional fake types with generic Variables
        const conditionRuleTypes = `
export type CountConditionRule = { type: "count"; value: number };
export type VariablesConditionRule<TVariables = Record<string, any>> = { type: "variables"; value: TVariables };
export type ConditionRule<TVariables = Record<string, any>> = CountConditionRule | VariablesConditionRule<TVariables>;
export type RegisterSequenceOptions<TVariables = Record<string, any>> = { requestCondition?: ConditionRule<TVariables> };`;
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
                    generateRegisterMutationMethod(fn.name, "options.fakeServerEndpoint"),
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
        const generateRegisterOperationMethod = (
            name: string,
            fakeEndpointVariableName: string,
        ) => {
            const variablesType = `${convertName(name, config)}QueryVariables`;
            return `async register${name}QueryResponse(sequenceId:string, queryResponse: ${name}Query, sequenceOptions?: RegisterSequenceOptions<${variablesType}>): Promise<${registerOperationResponseType}> {
    return await fetch(${fakeEndpointVariableName}, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'sequence-id': sequenceId
        },
        body: JSON.stringify({
            type: "operation",
            operationName: "${name}",
            data: queryResponse,
            ...(sequenceOptions?.requestCondition && { requestCondition: sequenceOptions.requestCondition })
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
            const variablesType = `${convertName(name, config)}MutationVariables`;
            return `async register${name}MutationResponse(sequenceId:string, mutationResponse: ${name}Mutation, sequenceOptions?: RegisterSequenceOptions<${variablesType}>): Promise<${registerOperationResponseType}> {
    return await fetch(${fakeEndpointVariableName}, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'sequence-id': sequenceId
        },
        body: JSON.stringify({
            type: "operation",
            operationName: "${name}",
            data: mutationResponse,
            ...(sequenceOptions?.requestCondition && { requestCondition: sequenceOptions.requestCondition })
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
