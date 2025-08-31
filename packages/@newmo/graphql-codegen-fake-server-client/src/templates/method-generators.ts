/**
 * Helper to indent each line of a string
 */
function indent(str: string, spaces = 4): string {
    const indentStr = " ".repeat(spaces);
    return str
        .split("\n")
        .map((line) => (line ? indentStr + line : line))
        .join("\n");
}

/**
 * Helper to create method templates with better readability
 */
function createMethod(config: {
    name: string;
    params: string;
    returnType: string;
    body: string;
}): string {
    return `async ${config.name}(${config.params}): Promise<${config.returnType}> {
${indent(config.body)}
}`;
}

/**
 * Generate register query method template
 */
export function generateRegisterQuery(params: {
    name: string;
    variablesType: string;
    responseType: string;
    endpoint: string;
}): string {
    return createMethod({
        name: `register${params.name}QueryResponse`,
        params: `sequenceId:string, queryResponse: ${params.name}Query, sequenceOptions?: FakeClientRegisterSequenceOptions<${params.variablesType}>`,
        returnType: params.responseType,
        body: `const requestCondition = sequenceOptions?.requestCondition ?? { type: "always" };
const response = await requestQueue.add(() => fetchWithRetry(
    ${params.endpoint},
    {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'sequence-id': sequenceId
        },
        body: JSON.stringify({
            type: "operation",
            operationName: "${params.name}",
            data: queryResponse,
            requestCondition: requestCondition
        }),
    }
));

const result = await response.json();
if (!response.ok) {
    const errorResult = result as { errors?: string[] };
    throw new Error(\`Failed to register fake response: \${response.status} \${response.statusText}\${errorResult.errors ? ' - ' + JSON.stringify(errorResult.errors) : ''}\`);
}
return result as ${params.responseType};`,
    });
}

/**
 * Generate register query error method template
 */
export function generateRegisterQueryError(params: {
    name: string;
    responseType: string;
    endpoint: string;
}): string {
    return createMethod({
        name: `register${params.name}QueryErrorResponse`,
        params: "sequenceId:string, { errors, responseStatusCode }: { errors: Record<string, unknown>[]; responseStatusCode: number }",
        returnType: params.responseType,
        body: `const response = await requestQueue.add(() => fetchWithRetry(
    ${params.endpoint},
    {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'sequence-id': sequenceId
        },
        body: JSON.stringify({
            type: "network-error",
            operationName: "${params.name}",
            responseStatusCode,
            errors
        }),
    }
));

const result = await response.json();
if (!response.ok) {
    const errorResult = result as { errors?: string[] };
    throw new Error(\`Failed to register fake error response: \${response.status} \${response.statusText}\${errorResult.errors ? ' - ' + JSON.stringify(errorResult.errors) : ''}\`);
}
return result as ${params.responseType};`,
    });
}

/**
 * Generate register mutation method template
 */
export function generateRegisterMutation(params: {
    name: string;
    variablesType: string;
    responseType: string;
    endpoint: string;
}): string {
    return createMethod({
        name: `register${params.name}MutationResponse`,
        params: `sequenceId:string, mutationResponse: ${params.name}Mutation, sequenceOptions?: FakeClientRegisterSequenceOptions<${params.variablesType}>`,
        returnType: params.responseType,
        body: `const requestCondition = sequenceOptions?.requestCondition ?? { type: "always" };
const response = await requestQueue.add(() => fetchWithRetry(
    ${params.endpoint},
    {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'sequence-id': sequenceId
        },
        body: JSON.stringify({
            type: "operation",
            operationName: "${params.name}",
            data: mutationResponse,
            requestCondition: requestCondition
        }),
    }
));

const result = await response.json();
if (!response.ok) {
    const errorResult = result as { errors?: string[] };
    throw new Error(\`Failed to register fake response: \${response.status} \${response.statusText}\${errorResult.errors ? ' - ' + JSON.stringify(errorResult.errors) : ''}\`);
}
return result as ${params.responseType};`,
    });
}

/**
 * Generate register mutation error method template
 */
export function generateRegisterMutationError(params: {
    name: string;
    responseType: string;
    endpoint: string;
}): string {
    return createMethod({
        name: `register${params.name}MutationErrorResponse`,
        params: "sequenceId:string, { errors, responseStatusCode }: { errors: Record<string, unknown>[]; responseStatusCode: number }",
        returnType: params.responseType,
        body: `const response = await requestQueue.add(() => fetchWithRetry(
    ${params.endpoint},
    {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'sequence-id': sequenceId
        },
        body: JSON.stringify({
            type: "network-error",
            operationName: "${params.name}",
            responseStatusCode,
            errors
        }),
    }
));

const result = await response.json();
if (!response.ok) {
    const errorResult = result as { errors?: string[] };
    throw new Error(\`Failed to register fake error response: \${response.status} \${response.statusText}\${errorResult.errors ? ' - ' + JSON.stringify(errorResult.errors) : ''}\`);
}
return result as ${params.responseType};`,
    });
}

/**
 * Generate called query method template
 */
export function generateCalledQuery(params: {
    name: string;
    variablesType: string;
    endpoint: string;
}): string {
    return createMethod({
        name: `called${params.name}Query`,
        params: "sequenceId:string",
        returnType: `{
  ok: true;
  data: {
    requestTimestamp: number;
    request: {
      headers: Record<string, unknown>;
      body: {
        operationName: string;
        query: string;
        variables: ${params.variablesType};
      };
    };
    response: {
        statusCode: number;
        headers: Record<string, unknown>;
        body: ${params.name}Query;
    };
  }[]            
}`,
        body: `const response = await requestQueue.add(() => fetchWithRetry(
    ${params.endpoint},
    {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'sequence-id': sequenceId
        },
        body: JSON.stringify({
            operationName: "${params.name}"
        }),
    }
));

const result = await response.json();
if (!response.ok) {
    const errorResult = result as { errors?: string[] };
    throw new Error(\`Failed to get called data: \${response.status} \${response.statusText}\${errorResult.errors ? ' - ' + JSON.stringify(errorResult.errors) : ''}\`);
}

return result as {
    ok: true;
    data: {
        requestTimestamp: number;
        request: {
            headers: Record<string, unknown>;
            body: {
                operationName: string;
                query: string;
                variables: ${params.variablesType};
            };
        };
        response: {
            statusCode: number;
            headers: Record<string, unknown>;
            body: ${params.name}Query;
        };
    }[];
};`,
    });
}

/**
 * Generate called mutation method template
 */
export function generateCalledMutation(params: {
    name: string;
    variablesType: string;
    endpoint: string;
}): string {
    return createMethod({
        name: `called${params.name}Mutation`,
        params: "sequenceId:string",
        returnType: `{
  ok: true;
  data: {
    requestTimestamp: number;
    request: {
      headers: Record<string, unknown>;
      body: {
        operationName: string;
        query: string;
        variables: ${params.variablesType};
      };
    };
    response: {
        statusCode: number;
        headers: Record<string, unknown>;
        body: ${params.name}Mutation;
    };
  }[];
}`,
        body: `const response = await requestQueue.add(() => fetchWithRetry(
    ${params.endpoint},
    {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'sequence-id': sequenceId
        },
        body: JSON.stringify({
            operationName: "${params.name}"
        }),
    }
));

const result = await response.json();
if (!response.ok) {
    const errorResult = result as { errors?: string[] };
    throw new Error(\`Failed to get called data: \${response.status} \${response.statusText}\${errorResult.errors ? ' - ' + JSON.stringify(errorResult.errors) : ''}\`);
}

return result as {
    ok: true;
    data: {
        requestTimestamp: number;
        request: {
            headers: Record<string, unknown>;
            body: {
                operationName: string;
                query: string;
                variables: ${params.variablesType};
            };
        };
        response: {
            statusCode: number;
            headers: Record<string, unknown>;
            body: ${params.name}Mutation;
        };
    }[];
};`,
    });
}
