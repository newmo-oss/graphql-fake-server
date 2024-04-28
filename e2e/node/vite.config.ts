import GithubActionsReporter from "vitest-github-actions-reporter";
import { defineConfig } from "vitest/config";

// eslint-disable-next-line import/no-default-export
export default defineConfig({
    test: {
        include: ["**/*.e2e.ts"],
        reporters: process.env.GITHUB_ACTIONS
            ? ["default", new GithubActionsReporter()]
            : "default",
    },
});
