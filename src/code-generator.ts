import { Config } from './config.js';
import { ExampleDirective, ObjectTypeInfo, TypeInfo } from './schema-scanner.js';
import { GraphQLSchema } from "graphql/index.js";

function generatePreludeCode(config: Config, typeInfos: TypeInfo[]): string {
    const joinedTypeNames = typeInfos
        .filter(({ type }) => type === 'object')
        .map(({ name }) => `  ${name}`)
        .join(',\n');
    const code = `
import type {
${joinedTypeNames},
} from '${config.typesFile}';
`.trim();
    return `${code}\n`;
}

const handleExample = (exampleDirective: ExampleDirective): string => {
    if ("value" in exampleDirective) {
        return JSON.stringify(exampleDirective.value);
    } else if ("expression" in exampleDirective) {
        return exampleDirective.expression;
    }
    throw new Error(`Invalid example directive${JSON.stringify(exampleDirective)}`);
}

function generateApolloFakeServer(config: Config, typeInfo: ObjectTypeInfo) {
    const header = `import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { addMocksToSchema } from '@graphql-tools/mock';
import { makeExecutableSchema } from '@graphql-tools/schema';
`;

    const body = `
const server = new ApolloServer({
  schema: addMocksToSchema({
    schema: makeExecutableSchema({ typeDefs }),
    mocks,
  }),
});
const { url } = await startStandaloneServer(server, { listen: { port: 4000 } });
console.log(\`🚀 Server listening at: \${url}\`);
`;
    return {
        header,
        body
    }
}

function generateExampleCode(config: Config, typeInfo: ObjectTypeInfo): string {
    const { name } = typeInfo;
    const indent = '  ';
    return `
/**
 * Default ${name} model using @example directive.
 */
const ${name} = {
${typeInfo.fields.flatMap((field) => {
        const example = field.example;
        if (example) {
            return [`${indent}${field.name}: ${handleExample(example)}`];
        }
        return [];
    }).join(',\n')}
};
exports.${name} = ${name};
`.trimStart();
}

export function generateCode(config: Config, typeInfos: TypeInfo[]): string {
    let code = '';
    // code += generatePreludeCode(config, typeInfos);
    // code += apolloFakeServer.header;
    // code += '\n';
    for (const typeInfo of typeInfos) {
        if (typeInfo.type === 'object') {
            code += generateExampleCode(config, typeInfo);
            code += '\n';
        }
    }
    return code;
}
