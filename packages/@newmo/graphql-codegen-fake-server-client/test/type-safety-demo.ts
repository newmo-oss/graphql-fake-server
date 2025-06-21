// Type safety demonstration
import { createFakeClient } from "./snapshots/typescript/fake-client";

const fakeClient = createFakeClient({
    fakeServerEndpoint: "http://localhost:4000/fake",
});

// For Type Check Testing
export async function demonstrateTypeSafety() {
    const sequenceId = "test-sequence";

    // ✅ Correct usage - single response registration
    await fakeClient.registerListDestinationCandidatesQuerySingleResponse(sequenceId, {
        destinationCandidates: [{ id: "1", name: "Tokyo" }],
    });

    // ✅ Correct usage - conditional response registration
    await fakeClient.registerListDestinationCandidatesQueryConditionalResponse(sequenceId, [
        {
            condition: {
                type: "variables",
                value: { text: "tokyo" }, // ✅ Matches ListDestinationCandidatesQueryVariables
            },
            data: {
                destinationCandidates: [{ id: "1", name: "Tokyo" }],
            },
        },
    ]);

    // ✅ Correct usage - mutation single response
    await fakeClient.registerCreateUrlRideHistoryMutationSingleResponse(sequenceId, {
        createURLRideHistory: { id: "1", name: "Shibuya" },
    });

    // ✅ Correct usage - mutation conditional response
    await fakeClient.registerCreateUrlRideHistoryMutationConditionalResponse(sequenceId, [
        {
            condition: {
                type: "variables",
                value: { desinationName: "Shibuya" }, // ✅ Matches CreateUrlRideHistoryMutationVariables
            },
            data: {
                createURLRideHistory: { id: "1", name: "Shibuya" },
            },
        },
    ]);

    // ✅ Correct usage - query sequence response
    await fakeClient.registerListRideHistoriesQuerySequenceResponse(sequenceId, [
        {
            rideHistories: [{ id: "1", destination: { id: "1", name: "Tokyo" } }],
        },
        {
            rideHistories: [{ id: "2", destination: { id: "2", name: "Osaka" } }],
        },
    ]);

    // Wrong variable type - conditional with wrong field
    await fakeClient.registerListDestinationCandidatesQueryConditionalResponse(sequenceId, [
        {
            condition: {
                type: "variables",
                // TypeScript error: 'wrongField' doesn't exist in ListDestinationCandidatesQueryVariables
                value: { wrongField: "value" } as unknown as { text: string },
            },
            data: {
                destinationCandidates: [],
            },
        },
    ]);

    // Wrong variable type for mutation
    await fakeClient.registerCreateUrlRideHistoryMutationConditionalResponse(sequenceId, [
        {
            condition: {
                type: "variables",
                // TypeScript error: 'text' doesn't exist in CreateUrlRideHistoryMutationVariables
                value: { text: "tokyo" } as unknown as { desinationName: string },
            },
            data: {
                createURLRideHistory: { id: "1", name: "Test" },
            },
        },
    ]);
}
