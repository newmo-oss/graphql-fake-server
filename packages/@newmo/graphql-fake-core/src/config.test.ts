import { describe, expect, it } from "vitest";
import {
    type Config,
    DefaultValues,
    normalizeConfig,
    type RawConfig,
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

    it("should throw error when maxTypeRecursion is not a number", () => {
        expect(() => validateConfig({ maxTypeRecursion: "2" as unknown as number })).toThrow(
            "config.maxTypeRecursion must be a number",
        );
    });

    it("should throw error when maxTypeRecursion is less than 1", () => {
        expect(() => validateConfig({ maxTypeRecursion: 0 })).toThrow(
            "config.maxTypeRecursion must be at least 1",
        );
    });

    it("should not throw error when maxTypeRecursion is valid", () => {
        expect(() => validateConfig({ maxTypeRecursion: 1 })).not.toThrow();
        expect(() => validateConfig({ maxTypeRecursion: 5 })).not.toThrow();
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

    it("should return default maxTypeRecursion of 2 when not specified", () => {
        const rawConfig: RawConfig = {};
        expect(normalizeConfig(rawConfig).maxTypeRecursion).toBe(2);
    });

    it("should use specified maxTypeRecursion value", () => {
        expect(normalizeConfig({ maxTypeRecursion: 1 }).maxTypeRecursion).toBe(1);
        expect(normalizeConfig({ maxTypeRecursion: 5 }).maxTypeRecursion).toBe(5);
    });
});
