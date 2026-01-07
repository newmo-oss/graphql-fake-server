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
        expect(() =>
            validateConfig({ mock: { defaultValues: "not an object" as unknown } }),
        ).toThrow();
    });

    it("should throw error when defaultValues contains invalid types", () => {
        expect(() =>
            validateConfig({
                mock: {
                    defaultValues: {
                        String: 123 as unknown as string,
                        Int: "not a number" as unknown as number,
                        Float: "not a number" as unknown as number,
                        Boolean: "not a boolean" as unknown as boolean,
                        ID: 123 as unknown as string,
                    },
                },
            }),
        ).toThrow();
    });

    it("should not throw error when rawConfig is valid", () => {
        expect(() =>
            validateConfig({
                mock: {
                    defaultValues: {
                        String: "string",
                        Int: 42,
                        Float: 4.2,
                        Boolean: true,
                        ID: "xxxx-xxxx-xxxx-xxxx",
                    },
                },
            }),
        ).not.toThrow();
    });

    it("should throw error when maxTypeRecursion is not a number", () => {
        expect(() =>
            validateConfig({ mock: { maxTypeRecursion: "2" as unknown as number } }),
        ).toThrow("config.mock.maxTypeRecursion must be a number");
    });

    it("should throw error when maxTypeRecursion is less than 1", () => {
        expect(() => validateConfig({ mock: { maxTypeRecursion: 0 } })).toThrow(
            "config.mock.maxTypeRecursion must be at least 1",
        );
    });

    it("should not throw error when maxTypeRecursion is valid", () => {
        expect(() => validateConfig({ mock: { maxTypeRecursion: 1 } })).not.toThrow();
        expect(() => validateConfig({ mock: { maxTypeRecursion: 5 } })).not.toThrow();
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
            mock: {
                defaultValues: {
                    String: "test",
                    Int: 1,
                    Float: 1.1,
                    Boolean: false,
                    ID: "test-id",
                },
            },
        };
        const expectedConfig: Config = normalizeConfig({
            mock: {
                defaultValues: {
                    String: "test",
                    Int: 1,
                    Float: 1.1,
                    Boolean: false,
                    ID: "test-id",
                },
            },
        });
        expect(normalizeConfig(rawConfig)).toEqual(expectedConfig);
    });

    it("should return a mix of rawConfig and default values when some values are missing in rawConfig", () => {
        const rawConfig: RawConfig = { mock: { defaultValues: { String: "test" } } };
        const expectedConfig: Config = normalizeConfig({
            mock: { defaultValues: { ...DefaultValues, String: "test" } },
        });
        expect(normalizeConfig(rawConfig).mock.defaultValues).toEqual(
            expectedConfig.mock.defaultValues,
        );
    });

    it("should return default maxTypeRecursion of 2 when not specified", () => {
        const rawConfig: RawConfig = {};
        expect(normalizeConfig(rawConfig).mock.maxTypeRecursion).toBe(2);
    });

    it("should use specified maxTypeRecursion value", () => {
        expect(normalizeConfig({ mock: { maxTypeRecursion: 1 } }).mock.maxTypeRecursion).toBe(1);
        expect(normalizeConfig({ mock: { maxTypeRecursion: 5 } }).mock.maxTypeRecursion).toBe(5);
    });
});
