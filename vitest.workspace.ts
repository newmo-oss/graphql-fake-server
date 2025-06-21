import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "./e2e/node/vitest.config.ts",
  "./packages/@newmo/**/vitest.config.ts",
]);
