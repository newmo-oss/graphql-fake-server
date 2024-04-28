#!/usr/bin/env node
import { run } from "./cli.js";

const ret = await run();
if (typeof ret !== "function") {
    if (ret.stdout) {
        console.log(ret.stdout);
    }
    if (ret.stderr) {
        console.error(ret.stderr);
    }
    process.exit(ret.exitCode);
}
