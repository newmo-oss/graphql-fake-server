import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

type RenovateGroup = {
    name: string;
    patterns: string[];
    automergePatterns: string[];
};

type PackageAnnotation = {
    group?: string;
    automerge?: boolean;
    ignore?: boolean;
};

// # Annotation
// @ から始まるコメントはアノテーションとして扱われる
// ------------------------------
// @pkg-group: {group}
//   renovate.json5の自動生成に利用されるRenovateのグループ
// @pkg-automerge
//   CIのチェックが通れば、automergeが可能なパッケージ
// @pkg-ignore
//   renovateでアップデートを無視するパッケージ
// ------------------------------

const assertRenovateGroupName = (name: string): boolean => {
    if (!name) {
        throw new Error("Renovate group name is empty");
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
        throw new Error(
            `Invalid renovate group name: ${name}. Must start with a letter, and can contain letters, underscores _, or hyphens -`,
        );
    }
    return true;
};

const parseAnnotationsFromComment = (comment: string): PackageAnnotation => {
    const annotations: PackageAnnotation = {};

    if (comment.includes("@pkg-group:")) {
        const match = comment.match(/@pkg-group:\s*([^\s]+)/);
        if (match) {
            annotations.group = match[1];
        }
    }
    if (comment.includes("@pkg-automerge")) {
        annotations.automerge = true;
    }
    if (comment.includes("@pkg-ignore")) {
        annotations.ignore = true;
    }

    return annotations;
};

/**
 * pnpm-workspace.yaml の catalog セクションを行ベースで解析する。
 * 各パッケージ行(`  'name': version` または `  name: version`)と、その直前のアノテーションコメントを対応付ける。
 * 外部依存(yaml libraryなど)を持たないようにrege/行解析で実装している。
 */
const parseCatalog = (
    workspaceContent: string,
): {
    annotations: Map<string, PackageAnnotation>;
    allPackages: string[];
} => {
    const lines = workspaceContent.split("\n");
    const annotations = new Map<string, PackageAnnotation>();
    const allPackages: string[] = [];
    let currentAnnotations: PackageAnnotation = {};
    let inCatalog = false;

    for (const line of lines) {
        if (!line) continue;

        // トップレベルの `catalog:` を検出
        if (/^catalog\s*:\s*$/.test(line)) {
            inCatalog = true;
            continue;
        }

        // catalogセクションの終端(別のトップレベルキー)を検出
        if (inCatalog && /^[a-zA-Z]/.test(line) && line.includes(":")) {
            inCatalog = false;
            continue;
        }

        if (!inCatalog) continue;

        if (line.trim().startsWith("#")) {
            const parsed = parseAnnotationsFromComment(line);
            currentAnnotations = { ...currentAnnotations, ...parsed };
            continue;
        }

        // パッケージ行: `  'pkg-name': version` または `  pkg-name: version`
        const match = line.match(/^\s+["']?([^"':\s]+)["']?\s*:\s*\S/);
        if (match) {
            const packageName = match[1];
            allPackages.push(packageName);
            if (Object.keys(currentAnnotations).length > 0) {
                annotations.set(packageName, { ...currentAnnotations });
                currentAnnotations = {};
            }
        }
    }

    return { annotations, allPackages };
};

const addPackageToGroup = (
    groups: Map<string, { patterns: string[]; automergePatterns: string[] }>,
    groupName: string,
    packageName: string,
    isAutomerge: boolean,
): Map<string, { patterns: string[]; automergePatterns: string[] }> => {
    assertRenovateGroupName(groupName);

    const existingGroup = groups.get(groupName) ?? {
        patterns: [],
        automergePatterns: [],
    };

    const updatedGroup = {
        patterns: [...existingGroup.patterns, packageName],
        automergePatterns: isAutomerge
            ? [...existingGroup.automergePatterns, packageName]
            : existingGroup.automergePatterns,
    };

    const newGroups = new Map(groups);
    newGroups.set(groupName, updatedGroup);
    return newGroups;
};

const extractRenovateGroups = (
    workspaceContent: string,
): {
    ignores: Set<string>;
    groups: RenovateGroup[];
    automergePackages: Set<string>;
    ungroupedPackages: string[];
    allPackages: Set<string>;
} => {
    let groups = new Map<string, { patterns: string[]; automergePatterns: string[] }>();
    const ignoreList = new Set<string>();
    const automergePackages = new Set<string>();
    const allPackages = new Set<string>();

    const { annotations: catalogAnnotations, allPackages: catalogPackages } =
        parseCatalog(workspaceContent);

    if (catalogPackages.length === 0) {
        throw new Error("catalog not found or empty in pnpm-workspace.yaml");
    }

    for (const packageName of catalogPackages) {
        allPackages.add(packageName);
        const annotations = catalogAnnotations.get(packageName);

        if (annotations?.ignore) {
            ignoreList.add(packageName);
            continue;
        }

        if (annotations?.automerge) {
            automergePackages.add(packageName);
        }

        if (annotations?.group) {
            groups = addPackageToGroup(
                groups,
                annotations.group,
                packageName,
                annotations.automerge ?? false,
            );
        }
    }

    const groupedPackages = new Set(Array.from(groups.values()).flatMap((g) => g.patterns));
    const ungroupedPackages = Array.from(allPackages).filter(
        (pkg) => !groupedPackages.has(pkg) && !ignoreList.has(pkg),
    );

    return {
        ignores: ignoreList,
        groups: Array.from(groups).map(([name, { patterns, automergePatterns }]) => ({
            name,
            patterns,
            automergePatterns,
        })),
        automergePackages,
        ungroupedPackages,
        allPackages,
    };
};

const generateRenovateConfig = (result: {
    groups: RenovateGroup[];
    ignores: Set<string>;
    automergePackages: Set<string>;
}) => {
    const { groups, ignores, automergePackages } = result;

    const packageRules = [];

    // メジャーアップデートを無視するルール
    packageRules.push({
        matchUpdateTypes: ["major"],
        enabled: false,
    });

    // pnpm自体のアップデート設定（patch/minorのみautomerge）
    packageRules.push({
        matchPackageNames: ["pnpm"],
        matchUpdateTypes: ["minor", "patch"],
        automerge: true,
        automergeType: "pr",
        platformAutomerge: true,
        addLabels: ["dependencies", "dependencies/automerge"],
    });

    // @pkg-ignore で指定されたパッケージを無視するルール
    if (ignores.size > 0) {
        packageRules.push({
            matchPackageNames: Array.from(ignores),
            enabled: false,
        });
    }

    // @pkg-group で指定されたグループのルール
    groups.forEach(({ name, patterns, automergePatterns }) => {
        const nonAutomergePatterns = patterns.filter((pkg) => !automergePatterns.includes(pkg));

        if (automergePatterns.length > 0) {
            packageRules.push({
                matchPackageNames: automergePatterns,
                groupName: `${name} automerge group`,
                groupSlug: `${name}-automerge`,
                matchUpdateTypes: ["minor", "patch"],
                addLabels: ["dependencies", "dependencies/automerge"],
                automerge: true,
                automergeType: "pr",
                platformAutomerge: true,
            });
        }

        if (nonAutomergePatterns.length > 0) {
            packageRules.push({
                matchPackageNames: nonAutomergePatterns,
                groupName: `${name} group`,
                groupSlug: `${name}`,
                matchUpdateTypes: ["minor", "patch"],
                addLabels: ["dependencies"],
            });
        }
    });

    // グループに属さないautomergeパッケージはエラー
    const groupedPackages = new Set(groups.flatMap((g) => g.patterns));
    const ungroupedAutomergePackages = Array.from(automergePackages).filter(
        (pkg) => !groupedPackages.has(pkg),
    );

    if (ungroupedAutomergePackages.length > 0) {
        throw new Error(
            `The following automerge packages are not grouped: ${ungroupedAutomergePackages.join(", ")}. Please add them to a group using @pkg-group {group} or ignore them with @pkg-ignore.`,
        );
    }

    return {
        packageRules,
    };
};

const main = async () => {
    try {
        const { values } = parseArgs({
            options: {
                "dry-run": {
                    type: "boolean",
                    short: "d",
                    default: false,
                },
                help: {
                    type: "boolean",
                    short: "h",
                    default: false,
                },
            },
            allowPositionals: false,
        });

        if (values.help) {
            console.log(`Generate renovate.json5 from pnpm-workspace.yaml catalog

Usage:
  node script/renovatebot/generate-renovatebot-json5.ts [options]

Options:
  -d, --dry-run    Print the generated config without writing to file
  -h, --help       Show help
`);
            process.exit(0);
        }

        const workspacePath = path.resolve(process.cwd(), "pnpm-workspace.yaml");
        const workspaceContent = fs.readFileSync(workspacePath, "utf-8");
        const result = extractRenovateGroups(workspaceContent);

        if (result.groups.length === 0) {
            throw new Error("No groups found in pnpm-workspace.yaml");
        }

        if (result.ungroupedPackages.length > 0) {
            console.error(
                "\nError: 以下のパッケージに @pkg-group または @pkg-ignore タグが設定されていません:",
            );
            result.ungroupedPackages.forEach((pkg) => {
                console.error(`  - ${pkg}`);
            });
            console.error(
                "\npnpm-workspace.yaml の catalog セクションで、各パッケージに @pkg-group: {group-name} または @pkg-ignore タグを追加してください。\n",
            );
            throw new Error(`Ungrouped packages found: ${result.ungroupedPackages.join(", ")}`);
        }

        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const rootDir = path.join(__dirname, "../../");
        const renovatePath = path.resolve(rootDir, "renovate.json5");

        try {
            const originalRenovateContent = fs.readFileSync(renovatePath, "utf-8");

            const generatedConfig = generateRenovateConfig(result);

            const newNpmConfig = {
                enabled: true,
                // 平日の09時から18時までの間にPRを作成する
                schedule: ["* 9-18 * * 1-5"],
                // リリースから7日経過しているものを対象にする
                minimumReleaseAge: "7 days",
                // minimumReleaseAge未満のリリースはPR作成自体をブロックする
                internalChecksFilter: "strict",
                packageRules: generatedConfig.packageRules,
            };

            const hasFrontendSectionInOriginal =
                originalRenovateContent.includes("// === <CATALOG> ===");

            if (!hasFrontendSectionInOriginal) {
                throw new Error("No <CATALOG> section found in renovate.json5");
            }

            const bannerText = "// Generated by script/renovatebot/generate-renovatebot-json5.ts";
            // renovate.json5の中で2-space indentを保つため、生成したJSONの各行(先頭以外)に
            // 2 spaceのpaddingを足してから埋め込む
            const npmConfigJson = JSON.stringify(newNpmConfig, null, 2)
                .split("\n")
                .map((line, i) => (i === 0 ? line : `  ${line}`))
                .join("\n");

            const generatedSection = [
                "  // === <CATALOG> ===",
                `  ${bannerText}`,
                `  "npm": ${npmConfigJson},`,
                "  // === </CATALOG> ===",
            ].join("\n");

            // 行頭の空白(既存のindent)を含めて置換するため `m` フラグと行頭からのマッチを使う
            const updatedContent = originalRenovateContent.replace(
                /^[ \t]*\/\/ === <CATALOG> ===\n[\s\S]*?^[ \t]*\/\/ === <\/CATALOG> ===/m,
                generatedSection,
            );

            const totalPackages = result.allPackages.size;
            const totalAutomergePackages = result.groups.reduce(
                (sum, g) => sum + g.automergePatterns.length,
                0,
            );
            const totalIgnoredPackages = result.ignores.size;
            const totalManualPackages =
                totalPackages - totalAutomergePackages - totalIgnoredPackages;

            const printSummary = () => {
                console.log("\n=== Summary ===");
                console.log(`Total packages: ${totalPackages}`);
                console.log(`Automerge packages: ${totalAutomergePackages}`);
                console.log(`Manual merge packages: ${totalManualPackages}`);
                console.log(`Ignored packages: ${totalIgnoredPackages}`);
                console.log(`Groups: ${result.groups.length}`);

                console.log("\n=== Group Details ===");
                result.groups.forEach((group) => {
                    const automergeCount = group.automergePatterns.length;
                    const manualCount = group.patterns.length - automergeCount;
                    console.log(
                        `${group.name}: total ${group.patterns.length} (automerge: ${automergeCount}, manual: ${manualCount})`,
                    );
                });
            };

            if (values["dry-run"]) {
                console.log("\n=== Found Renovate Groups ===");
                console.log(JSON.stringify(result, null, 2));
                console.log("\n=== Generated Config ===");
                console.log(updatedContent);
                printSummary();
            } else {
                fs.writeFileSync(renovatePath, updatedContent);
                try {
                    execSync(
                        `npx --package "@biomejs/biome" -- biome format --write "${renovatePath}"`,
                        { stdio: "inherit" },
                    );
                } catch (error) {
                    console.warn(`Warning: Failed to format with biome: ${error}`);
                }
                console.log(`Updated npm section in ${renovatePath}`);
                printSummary();
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                throw new Error("renovate.json5 not found. Please create renovate.json5 first.", {
                    cause: error,
                });
            }
            throw error;
        }
    } catch (error) {
        console.error("Error:", error);
        if (error instanceof Error) {
            console.error("Stack trace:", error.stack);
        }
        process.exit(1);
    }
};

main().catch((error) => {
    console.error(
        new Error("Failed to generate renovate.json5", {
            cause: error,
        }),
    );
    process.exit(1);
});
