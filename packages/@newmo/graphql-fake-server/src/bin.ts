#!/usr/bin/env node
import { run } from "./cli.js";

const ret = await run();
if (ret.stdout) {
  console.log(ret.stdout);
}
if (ret.stderr) {
  console.error(ret.stderr);
}
if (!ret.doNotExit) {
  process.exit(ret.exitCode);
}
// Fast exit on SIGTERM
process.on("SIGTERM", () => {
  process.exit(0);
});
