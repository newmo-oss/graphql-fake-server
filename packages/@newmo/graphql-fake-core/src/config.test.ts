import { describe, expect, it } from "vitest";
import {
    type Config,
    DefaultValues,
    type RawConfig,
    normalizeConfig,
    validateConfig,
} from "./config.js";

describe("validateConfig", () => {
    it("should throw error when rawConfig is not an object or is null", () => {
        expect(() => validateConfig(null)).toThrow();
        expect(() => validateConfig("not an object")).toThrow();
    });

    it("should throw error when defaultValues is not an object", () => {
        expect(() => validateConfig({ defaultValues: "not an object" })).toThrow();
    });

    it("should throw error when defaultValues contains invalid types", () => {
        expect(() =>
            validateConfig({
                defaultValues: {
                    String: 123,
                    Int: "not a number",
                    Float: "not a number",
                    Boolean: "not a boolean",
                    ID: 123,
                    listLength: "not a number",
                },
            }),
        ).toThrow();
    });
    it("should throw error when maxFieldRecursionDepth is not a number", () => {
        expect(() => validateConfig({ maxFieldRecursionDepth: "not a number" })).toThrow();
    });

    it("should not throw error when rawConfig is valid", () => {
        expect(() =>
            validateConfig({
                defaultValues: {
                    String: "string",
                    Int: 42,
                    Float: 4.2,
                    Boolean: true,
                    ID: "xxxx-xxxx-xxxx-xxxx",
                    listLength: 3,
                },
            }),
        ).not.toThrow();
    });
});

describe("normalizeConfig", () => {
    it("should return default values when rawConfig is empty", () => {
        const rawConfig: RawConfig = {};
        const expectedConfig = normalizeConfig(rawConfig);
        expect(normalizeConfig(rawConfig)).toEqual(expectedConfig);
    });

    it("should return rawConfig values when they are present", () => {
        const rawConfig: RawConfig = {
            defaultValues: {
                String: "test",
                Int: 1,
                Float: 1.1,
                Boolean: false,
                ID: "test-id",
                listLength: 1,
            },
        };
        const expectedConfig: Config = normalizeConfig({
            defaultValues: {
                String: "test",
                Int: 1,
                Float: 1.1,
                Boolean: false,
                ID: "test-id",
                listLength: 1,
            },
        });
        expect(normalizeConfig(rawConfig)).toEqual(expectedConfig);
    });

    it("should return a mix of rawConfig and default values when some values are missing in rawConfig", () => {
        const rawConfig: RawConfig = { defaultValues: { String: "test" } };
        const expectedConfig: Config = normalizeConfig({
            defaultValues: { ...DefaultValues, String: "test" },
        });
        expect(normalizeConfig(rawConfig).defaultValues).toEqual(expectedConfig.defaultValues);
    });
});
