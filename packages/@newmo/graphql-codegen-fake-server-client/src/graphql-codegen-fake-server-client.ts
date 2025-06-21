import type { CodegenPlugin } from "@graphql-codegen/plugin-helpers";
import { normalizeConfig, type RawPluginConfig } from "./config";
import { convertName } from "./convertName";

const plugin: CodegenPlugin<RawPluginConfig> = {
    plugin(_schema, documents, rawConfig, _info) {
        const config = normalizeConfig(rawConfig);
        const _fakeEndpoint = config.fakeServerEndpoint;
        const registerOperationResponseType = "{ ok: true } | { ok: false; errors: string[] }";

        // New unified API types
        const unifiedApiTypes = `
export type FakeClientVariablesConditionRule<TVariables = Record<string, any>> = { type: "variables"; value: TVariables };
export type FakeClientAlwaysConditionRule = { type: "always" };
export type FakeClientConditionRule<TVariables = Record<string, any>> = 
    | FakeClientVariablesConditionRule<TVariables> 
    | FakeClientAlwaysConditionRule;

export type FakeClientRequestConditions<TVariables = Record<string, any>> = {
    requestConditions: FakeClientConditionRule<TVariables>;
};`;
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
  const fakeServerEndpoint = options.fakeServerEndpoint;
  return {
${exportsFunctions
    .flatMap((fn) => {
        if (fn.type === "query") {
            return [
                indentEachLine(`${indent}${indent}`, generateRegisterQueryMethod(fn.name)),
                indentEachLine(
                    `${indent}${indent}`,
                    generateCalledQuery(fn.name, `fakeServerEndpoint + "/called"`),
                ),
            ];
        }
        if (fn.type === "mutation") {
            return [
                indentEachLine(`${indent}${indent}`, generateRegisterMutationMethod(fn.name)),
                indentEachLine(
                    `${indent}${indent}`,
                    generateCalledMutation(fn.name, `fakeServerEndpoint + "/called"`),
                ),
            ];
        }
        throw new Error(`Unknown type${fn}`);
    })
    .join(",\n")}
  };
}`;
        };

        // Unified query registration method
        const generateRegisterQueryMethod = (name: string) => {
            const variablesType = `${convertName(name, config)}QueryVariables`;
            return `async register${name}Response(
    sequenceId: string, 
    data: ${name}Query | ${name}Query[] | { errors: Record<string, unknown>[]; responseStatusCode: number },
    requestOptions?: { requestConditions?: FakeClientConditionRule<${variablesType}> }
): Promise<${registerOperationResponseType}> {
    // Default requestConditions to { type: "always" } if not provided
    const requestConditions = requestOptions?.requestConditions ?? { type: "always" };
    
    let requestBody: any;
    
    // Check if it's a network error
    if (typeof data === 'object' && data !== null && 'errors' in data && 'responseStatusCode' in data) {
        requestBody = {
            type: "network-error",
            operationName: "${name}",
            responseStatusCode: data.responseStatusCode,
            errors: data.errors
        };
    }
    // Check if it's sequence responses (array)
    else if (Array.isArray(data)) {
        requestBody = {
            type: "conditional",
            operationName: "${name}",
            conditions: [{
                condition: requestConditions,
                data: data
            }]
        };
    }
    // Single response
    else {
        requestBody = {
            type: "conditional",
            operationName: "${name}",
            conditions: [{
                condition: requestConditions,
                data: data
            }]
        };
    }

    return await fetch(fakeServerEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'sequence-id': sequenceId
        },
        body: JSON.stringify(requestBody),
    }).then((res) => res.json()) as ${registerOperationResponseType};
}`;
        };

        // Unified mutation registration method
        const generateRegisterMutationMethod = (name: string) => {
            const variablesType = `${convertName(name, config)}MutationVariables`;
            return `async register${name}Response(
    sequenceId: string, 
    data: ${name}Mutation | ${name}Mutation[] | { errors: Record<string, unknown>[]; responseStatusCode: number },
    requestOptions?: { requestConditions?: FakeClientConditionRule<${variablesType}> }
): Promise<${registerOperationResponseType}> {
    // Default requestConditions to { type: "always" } if not provided
    const requestConditions = requestOptions?.requestConditions ?? { type: "always" };
    
    let requestBody: any;
    
    // Check if it's a network error
    if (typeof data === 'object' && data !== null && 'errors' in data && 'responseStatusCode' in data) {
        requestBody = {
            type: "network-error",
            operationName: "${name}",
            responseStatusCode: data.responseStatusCode,
            errors: data.errors
        };
    }
    // Check if it's sequence responses (array)
    else if (Array.isArray(data)) {
        requestBody = {
            type: "conditional",
            operationName: "${name}",
            conditions: [{
                condition: requestConditions,
                data: data
            }]
        };
    }
    // Single response
    else {
        requestBody = {
            type: "conditional",
            operationName: "${name}",
            conditions: [{
                condition: requestConditions,
                data: data
            }]
        };
    }

    return await fetch(fakeServerEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'sequence-id': sequenceId
        },
        body: JSON.stringify(requestBody),
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
${unifiedApiTypes}
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
