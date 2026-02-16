import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from "@apollo/client/core";
import { loadDevMessages, loadErrorMessages } from "@apollo/client/dev";
import { createFakeServer, normalizeFakeServerConfig } from "@newmo/graphql-fake-server";
import { createFakeClient } from "./generated/fake.js";

loadDevMessages();
loadErrorMessages();

export const createApolloClient = (options: {
    uri: string;
    sequenceId?: string;
    errorLink?: ApolloLink;
}) => {
    const { uri, sequenceId, errorLink } = options;

    const httpLink = new HttpLink({
        uri,
        fetch,
        headers: sequenceId ? { "sequence-id": sequenceId } : {},
    });

    const links = errorLink ? [errorLink, httpLink] : [httpLink];

    return new ApolloClient({
        link: ApolloLink.from(links),
        cache: new InMemoryCache(),
        defaultOptions: {
            query: {
                fetchPolicy: "no-cache",
            },
            mutate: {
                fetchPolicy: "no-cache",
            },
        },
    });
};

export const startTestServer = async (ports: { fakeServer: number; apolloServer: number }) => {
    const server = await createFakeServer(
        normalizeFakeServerConfig({
            schemaFilePath: "./api/api.graphqls",
            logLevel: "debug",
            server: {
                ports,
            },
            mock: {
                defaultValues: {
                    CustomScalar: {
                        DATE_YYYYMMDD: `"2022-01-01"`,
                    },
                },
            },
        }),
    );
    const { urls } = await server.start();
    return { server, urls };
};

export const createTestFakeClient = (fakeServerPort: number) => {
    return createFakeClient({
        fakeServerEndpoint: `http://127.0.0.1:${fakeServerPort}/fake`,
    });
};
