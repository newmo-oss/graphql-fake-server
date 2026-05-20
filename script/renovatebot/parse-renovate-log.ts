#!/usr/bin/env node
/**
 * Parse Renovate JSON logs and generate a GITHUB_STEP_SUMMARY markdown report.
 *
 * Usage:
 *   LOG_FORMAT=json renovate --platform=local 2>&1 | node script/renovatebot/parse-renovate-log.ts
 */
import fs from "node:fs";
import readline from "node:readline";

type DepUpdate = {
    updateType: string;
    newVersion: string;
    newValue: string;
};

type Dep = {
    depName: string;
    currentValue: string;
    currentVersion: string;
    updates: DepUpdate[];
    warnings: { message: string }[];
    skipReason?: string;
};

type PackageFile = {
    packageFile: string;
    deps: Dep[];
};

type LogEntry = {
    level: number;
    msg: string;
    config?: Record<string, PackageFile[]>;
    enabledManagers?: string[];
    warnings?: { message: string }[];
    [key: string]: unknown;
};

const main = async () => {
    const rl = readline.createInterface({ input: process.stdin });

    const logEntries: LogEntry[] = [];

    for await (const line of rl) {
        try {
            const parsed = JSON.parse(line) as LogEntry;
            logEntries.push(parsed);
        } catch {
            // skip non-JSON lines
        }
    }

    const lines: string[] = [];

    const managersEntry = logEntries.find(
        (e) =>
            e.msg === "Using enabledManagers" ||
            (e.enabledManagers && Array.isArray(e.enabledManagers)),
    );
    if (managersEntry?.enabledManagers) {
        lines.push("## Enabled Managers");
        lines.push("");
        for (const m of managersEntry.enabledManagers as string[]) {
            lines.push(`- \`${m}\``);
        }
        lines.push("");
    }

    const updateEntry = logEntries.find((e) => e.msg === "packageFiles with updates" && e.config);

    if (updateEntry?.config) {
        lines.push("## Detected Dependencies");
        lines.push("");

        for (const [manager, packageFiles] of Object.entries(
            updateEntry.config as Record<string, PackageFile[]>,
        )) {
            const allDeps = packageFiles.flatMap((pf) =>
                pf.deps.map((d) => ({ ...d, packageFile: pf.packageFile })),
            );

            if (allDeps.length === 0) continue;

            lines.push(`### ${manager}`);
            lines.push("");
            lines.push("| File | Package | Current | Update | Type |");
            lines.push("|------|---------|---------|--------|------|");

            for (const dep of allDeps) {
                const current = dep.currentValue || dep.currentVersion || "-";

                if (dep.skipReason) {
                    lines.push(
                        `| ${dep.packageFile} | ${dep.depName} | \`${current}\` | _skipped: ${dep.skipReason}_ | - |`,
                    );
                    continue;
                }

                if (dep.updates.length === 0) {
                    lines.push(
                        `| ${dep.packageFile} | ${dep.depName} | \`${current}\` | (up to date) | - |`,
                    );
                    continue;
                }

                for (const update of dep.updates) {
                    const newVer = update.newVersion || update.newValue || "?";
                    lines.push(
                        `| ${dep.packageFile} | ${dep.depName} | \`${current}\` | \`${newVer}\` | ${update.updateType} |`,
                    );
                }
            }

            lines.push("");
        }
    } else {
        lines.push("## Detected Dependencies");
        lines.push("");
        lines.push(
            "_No 'packageFiles with updates' message found in logs. Check the raw log output._",
        );
        lines.push("");
    }

    const warnings = logEntries
        .filter((e) => e.level >= 40 && e.level < 50 && e.msg && !e.msg.includes("deprecated"))
        .map((e) => e.msg);

    if (warnings.length > 0) {
        lines.push("## Warnings");
        lines.push("");
        for (const w of warnings) {
            lines.push(`- ${w}`);
        }
        lines.push("");
    }

    const errors = logEntries.filter((e) => e.level >= 50).map((e) => e.msg);

    if (errors.length > 0) {
        lines.push("## Errors");
        lines.push("");
        for (const err of errors) {
            lines.push(`- ${err}`);
        }
        lines.push("");
    }

    const markdown = lines.join("\n");
    console.log(markdown);

    const summaryPath = process.env["GITHUB_STEP_SUMMARY"];
    if (summaryPath) {
        fs.appendFileSync(summaryPath, `${markdown}\n`);
    }
};

main().catch((err) => {
    console.error("Failed to parse renovate logs:", err);
    process.exit(1);
});
