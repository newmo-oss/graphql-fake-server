// Conditional fake usage examples

// Basic usage example
const sequenceId = "example-sequence-1";

// 1. Count-based condition example
async function setupCountBasedFake() {
  // Register fake for the first call
  await fetch("http://127.0.0.1:4000/fake", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "sequence-id": sequenceId,
    },
    body: JSON.stringify({
      type: "operation",
      operationName: "GetBooks",
      requestCondition: { type: "count", value: 1 },
      data: {
        books: [{ id: "book-1", title: "First Call Book" }],
      },
    }),
  });

  // Register fake for the second call
  await fetch("http://127.0.0.1:4000/fake", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "sequence-id": sequenceId,
    },
    body: JSON.stringify({
      type: "operation",
      operationName: "GetBooks",
      requestCondition: { type: "count", value: 2 },
      data: {
        books: [{ id: "book-2", title: "Second Call Book" }],
      },
    }),
  });
}

// 2. Variables-based condition example
async function setupVariablesBasedFake() {
  const fileSequenceId = "file-download-sequence";

  // Register fake for fileType: "A"
  await fetch("http://127.0.0.1:4000/fake", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "sequence-id": fileSequenceId,
    },
    body: JSON.stringify({
      type: "operation",
      operationName: "downloadUrlsResponseToUploadedFiles",
      requestCondition: {
        type: "variables",
        value: {
          input: {
            fileType: "A",
          },
        },
      },
      data: {
        downloadUrlsResponseToUploadedFiles: {
          payload: {
            urls: ["https://example.com/file-a.pdf"],
          },
        },
      },
    }),
  });

  // Register fake for fileType: "B"
  await fetch("http://127.0.0.1:4000/fake", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "sequence-id": fileSequenceId,
    },
    body: JSON.stringify({
      type: "operation",
      operationName: "downloadUrlsResponseToUploadedFiles",
      requestCondition: {
        type: "variables",
        value: {
          input: {
            fileType: "B",
          },
        },
      },
      data: {
        downloadUrlsResponseToUploadedFiles: {
          payload: {
            urls: ["https://example.com/file-b.xlsx"],
          },
        },
      },
    }),
  });
}

// 3. Complex condition example
async function setupComplexConditionFake() {
  const complexSequenceId = "complex-sequence";

  // Register fake with AND condition
  await fetch("http://127.0.0.1:4000/fake", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "sequence-id": complexSequenceId,
    },
    body: JSON.stringify({
      type: "operation",
      operationName: "GetUserData",
      requestCondition: {
        type: "and",
        conditions: [
          { type: "count", value: 1 },
          { type: "variables", value: { userId: "user123" } },
        ],
      },
      data: {
        user: { id: "user123", name: "First Call User" },
      },
    }),
  });

  // Register fake with OR condition
  await fetch("http://127.0.0.1:4000/fake", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "sequence-id": complexSequenceId,
    },
    body: JSON.stringify({
      type: "operation",
      operationName: "GetUserData",
      requestCondition: {
        type: "or",
        conditions: [
          { type: "variables", value: { userId: "admin" } },
          { type: "variables", value: { role: "admin" } },
        ],
      },
      data: {
        user: { id: "admin", name: "Admin User" },
      },
    }),
  });
}

// Execute examples
async function _runExamples() {
  console.log("Setting up conditional fakes...");

  await setupCountBasedFake();
  await setupVariablesBasedFake();
  await setupComplexConditionFake();

  console.log("Conditional fakes are now registered!");
  console.log("You can now test them by making GraphQL requests to the server.");
}

// Execute
// runExamples().catch(console.error);

export { setupCountBasedFake, setupVariablesBasedFake, setupComplexConditionFake };
