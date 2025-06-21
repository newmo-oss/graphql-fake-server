// Type safety demonstration
import { createFakeClient } from "./snapshots/typescript/fake-client";

const fakeClient = createFakeClient({
    fakeServerEndpoint: "http://localhost:4000/fake",
});

// For Type Check Testing
export async function demonstrateTypeSafety() {
    const sequenceId = "test-sequence";

    // ✅ Correct usage - type-safe variables
    await fakeClient.registerListDestinationCandidatesQueryResponse(
        sequenceId,
        {
            destinationCandidates: [{ id: "1", name: "Tokyo" }],
        },
        {
            requestCondition: {
                type: "variables",
                value: { text: "tokyo" }, // ✅ Matches ListDestinationCandidatesQueryVariables
            },
        },
    );

    // ✅ Correct usage - mutation with variables
    await fakeClient.registerCreateUrlRideHistoryMutationResponse(
        sequenceId,
        {
            createURLRideHistory: { id: "1", name: "Shibuya" },
        },
        {
            requestCondition: {
                type: "variables",
                value: { desinationName: "Shibuya" }, // ✅ Matches CreateUrlRideHistoryMutationVariables
            },
        },
    );

    // ✅ Correct usage - query without variables
    await fakeClient.registerListRideHistoriesQueryResponse(
        sequenceId,
        {
            rideHistories: [{ id: "1", destination: { id: "1", name: "Tokyo" } }],
        },
        {
            requestCondition: {
                type: "variables",
                value: {}, // ✅ ListRideHistoriesQueryVariables = Exact<{ [key: string]: never }>
            },
        },
    );

    // Wrong variable type
    await fakeClient.registerListDestinationCandidatesQueryResponse(
        sequenceId,
        {
            destinationCandidates: [],
        },
        {
            requestCondition: {
                type: "variables",
                // @ts-expect-error // ❌ TypeScript error: 'text' should be a string, not a number
                value: { wrongField: "value" },
            },
        },
    );

    // Wrong variable type for mutation
    await fakeClient.registerCreateUrlRideHistoryMutationResponse(
        sequenceId,
        {
            createURLRideHistory: { id: "1", name: "Test" },
        },
        {
            requestCondition: {
                type: "variables",
                // @ts-expect-error
                value: { text: "tokyo" },
            },
        },
    );
}
