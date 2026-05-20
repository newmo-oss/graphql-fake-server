import type { CodegenPlugin } from "@graphql-codegen/plugin-helpers";
import { normalizeConfig, type RawPluginConfig } from "./config.js";
import { convertName } from "./convertName.js";
import {
    generateCalledMutation,
    generateCalledQuery,
    generateRegisterMutation,
    generateRegisterMutationError,
    generateRegisterQuery,
    generateRegisterQueryError,
} from "./templates/method-generators.js";
import { getRuntimeCode } from "./templates/runtime.js";

const fakeServerClientPlugin: CodegenPlugin<RawPluginConfig> = {
    plugin(_schema, documents, rawConfig, _info) {
        const config = normalizeConfig(rawConfig);
        const registerOperationResponseType = "{ ok: true }";

        // Get runtime code from template function
        const runtimeCode = getRuntimeCode();

        // Conditional fake types with generic Variables
        const conditionRuleTypes = `
export type FakeClientAlwaysConditionRule = { type: "always" };
export type FakeClientVariablesConditionRule<TVariables = Record<string, any>> = { type: "variables"; value: TVariables };
export type FakeClientConditionRule<TVariables = Record<string, any>> = FakeClientAlwaysConditionRule | FakeClientVariablesConditionRule<TVariables>;
export type FakeClientRegisterSequenceOptions<TVariables = Record<string, any>> = { requestCondition?: FakeClientConditionRule<TVariables> };`;
        type GenerateFakeFunction =
            | {
                  type: "query";
                  name: string;
                  operationName: string;
              }
            | {
                  type: "mutation";
                  name: string;
                  operationName: string;
              };
        const indentEachLine = (indent: string, text: string) => {
            return text
                .split("\n")
                .map((line) => indent + line)
                .join("\n");
        };
        const generateFakeClient = (exportsFunctions: GenerateFakeFunction[]) => {
            const indent = "  ";

            // Use runtime code from template
            return (
                runtimeCode +
                "\n\n" +
                "export function createFakeClient(options: CreateFakeClientOptions) {\n" +
                "  if(!options.fakeServerEndpoint.endsWith('/fake')) {\n" +
                "    throw new Error('fakeServerEndpoint must end with \"/fake\"');\n" +
                "  }\n" +
                "  \n" +
                "  // Create request queue for rate limiting\n" +
                "  const requestQueue = new RequestQueue();\n" +
                "  \n" +
                "  return {\n" +
                exportsFunctions
                    .flatMap((fn) => {
                        if (fn.type === "query") {
                            return [
                                indentEachLine(
                                    indent + indent,
                                    generateRegisterOperationMethod(
                                        fn.name,
                                        fn.operationName,
                                        "options.fakeServerEndpoint",
                                    ),
                                ),
                                indentEachLine(
                                    indent + indent,
                                    generateRegisterOperationErrorMethod(
                                        fn.name,
                                        fn.operationName,
                                        "options.fakeServerEndpoint",
                                    ),
                                ),
                                indentEachLine(
                                    indent + indent,
                                    generateCalledQueryMethod(
                                        fn.name,
                                        fn.operationName,
                                        'options.fakeServerEndpoint + "/called"',
                                    ),
                                ),
                            ];
                        }
                        if (fn.type === "mutation") {
                            return [
                                indentEachLine(
                                    indent + indent,
                                    generateRegisterMutationMethod(
                                        fn.name,
                                        fn.operationName,
                                        "options.fakeServerEndpoint",
                                    ),
                                ),
                                indentEachLine(
                                    indent + indent,
                                    generateRegisterMutationErrorMethod(
                                        fn.name,
                                        fn.operationName,
                                        "options.fakeServerEndpoint",
                                    ),
                                ),
                                indentEachLine(
                                    indent + indent,
                                    generateCalledMutationMethod(
                                        fn.name,
                                        fn.operationName,
                                        'options.fakeServerEndpoint + "/called"',
                                    ),
                                ),
                            ];
                        }
                        throw new Error(`Unknown type${fn}`);
                    })
                    .join(",\n") +
                "\n  };\n}"
            );
        };
        const generateRegisterOperationMethod = (
            name: string,
            operationName: string,
            fakeEndpointVariableName: string,
        ) => {
            const variablesType = `${name}QueryVariables`;
            return generateRegisterQuery({
                name,
                operationName,
                variablesType,
                responseType: registerOperationResponseType,
                endpoint: fakeEndpointVariableName,
            });
        };
        const generateRegisterOperationErrorMethod = (
            name: string,
            operationName: string,
            fakeEndpointVariableName: string,
        ) => {
            return generateRegisterQueryError({
                name,
                operationName,
                responseType: registerOperationResponseType,
                endpoint: fakeEndpointVariableName,
            });
        };
        const generateRegisterMutationMethod = (
            name: string,
            operationName: string,
            fakeEndpointVariableName: string,
        ) => {
            const variablesType = `${name}MutationVariables`;
            return generateRegisterMutation({
                name,
                operationName,
                variablesType,
                responseType: registerOperationResponseType,
                endpoint: fakeEndpointVariableName,
            });
        };
        const generateRegisterMutationErrorMethod = (
            name: string,
            operationName: string,
            fakeEndpointVariableName: string,
        ) => {
            return generateRegisterMutationError({
                name,
                operationName,
                responseType: registerOperationResponseType,
                endpoint: fakeEndpointVariableName,
            });
        };
        const generateCalledQueryMethod = (
            name: string,
            operationName: string,
            calledEndpoint: string,
        ) => {
            const variablesType = `${name}QueryVariables`;
            return generateCalledQuery({
                name,
                operationName,
                variablesType,
                endpoint: calledEndpoint,
            });
        };

        const generateCalledMutationMethod = (
            name: string,
            operationName: string,
            calledEndpoint: string,
        ) => {
            const variablesType = `${name}MutationVariables`;
            return generateCalledMutation({
                name,
                operationName,
                variablesType,
                endpoint: calledEndpoint,
            });
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
        const importsSection = documents
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
            .join("\n");

        const functionsSection = generateFakeClient(
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
                                    operationName: definition.name.value,
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
                                    operationName: definition.name.value,
                                    type: "mutation",
                                },
                            ] satisfies GenerateFakeFunction[] as GenerateFakeFunction[];
                        }
                        return [];
                    }) ?? [];
                return flatMap satisfies GenerateFakeFunction[] as GenerateFakeFunction[];
            }),
        );

        return (
            "/* eslint-disable */\n" +
            "// This file was generated by a @newmo/graphql-codegen-fake-server-operation\n" +
            importsSection +
            "\n" +
            conditionRuleTypes +
            "\n" +
            functionsSection +
            "\n"
        );
    },
};
export const { plugin } = fakeServerClientPlugin;
export default fakeServerClientPlugin;
