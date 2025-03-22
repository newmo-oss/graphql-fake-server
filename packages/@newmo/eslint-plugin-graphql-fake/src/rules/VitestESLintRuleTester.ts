import { RuleTester } from "eslint";
import { describe, it } from "vitest";

// replace `describe` and `it` with `vitest`'s
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;
export { RuleTester as VitestESLintRuleTester };
