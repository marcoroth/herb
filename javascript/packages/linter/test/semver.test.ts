import { describe, test, expect } from "vitest"

import { parseSemver, compareSemver, semverGreaterThan, UNRELEASED_VERSION } from "../src/semver.js"

describe("@herb-tools/linter", () => {
  describe("parseSemver", () => {
    test("parses major.minor.patch", () => {
      expect(parseSemver("1.2.3")).toEqual([1, 2, 3])
    })

    test("parses major.minor without patch", () => {
      expect(parseSemver("1.2")).toEqual([1, 2, 0])
    })

    test("parses zero versions", () => {
      expect(parseSemver("0.0.0")).toEqual([0, 0, 0])
    })

    test("parses large version numbers", () => {
      expect(parseSemver("10.20.30")).toEqual([10, 20, 30])
    })

    test("returns [0,0,0] for invalid strings", () => {
      expect(parseSemver("invalid")).toEqual([0, 0, 0])
    })

    test("returns [0,0,0] for empty string", () => {
      expect(parseSemver("")).toEqual([0, 0, 0])
    })

    test("returns [0,0,0] for too many parts", () => {
      expect(parseSemver("1.2.3.4")).toEqual([0, 0, 0])
    })

    test("returns [0,0,0] for non-numeric parts", () => {
      expect(parseSemver("a.b.c")).toEqual([0, 0, 0])
    })
  })

  describe("compareSemver", () => {
    test("returns 0 for equal versions", () => {
      expect(compareSemver("1.2.3", "1.2.3")).toBe(0)
    })

    test("returns positive when first is greater (major)", () => {
      expect(compareSemver("2.0.0", "1.0.0")).toBeGreaterThan(0)
    })

    test("returns negative when first is lesser (major)", () => {
      expect(compareSemver("1.0.0", "2.0.0")).toBeLessThan(0)
    })

    test("returns positive when first is greater (minor)", () => {
      expect(compareSemver("1.2.0", "1.1.0")).toBeGreaterThan(0)
    })

    test("returns negative when first is lesser (minor)", () => {
      expect(compareSemver("1.1.0", "1.2.0")).toBeLessThan(0)
    })

    test("returns positive when first is greater (patch)", () => {
      expect(compareSemver("1.2.4", "1.2.3")).toBeGreaterThan(0)
    })

    test("returns negative when first is lesser (patch)", () => {
      expect(compareSemver("1.2.3", "1.2.4")).toBeLessThan(0)
    })

    test("unreleased is greater than any version", () => {
      expect(compareSemver(UNRELEASED_VERSION, "99.99.99")).toBeGreaterThan(0)
    })

    test("any version is less than unreleased", () => {
      expect(compareSemver("99.99.99", UNRELEASED_VERSION)).toBeLessThan(0)
    })

    test("unreleased equals unreleased", () => {
      expect(compareSemver(UNRELEASED_VERSION, UNRELEASED_VERSION)).toBe(0)
    })
  })

  describe("semverGreaterThan", () => {
    test("returns true when first is greater", () => {
      expect(semverGreaterThan("0.9.0", "0.8.10")).toBe(true)
    })

    test("returns false when first is lesser", () => {
      expect(semverGreaterThan("0.8.10", "0.9.0")).toBe(false)
    })

    test("returns false when equal", () => {
      expect(semverGreaterThan("0.9.0", "0.9.0")).toBe(false)
    })

    test("unreleased is greater than any version", () => {
      expect(semverGreaterThan(UNRELEASED_VERSION, "99.99.99")).toBe(true)
    })

    test("no version is greater than unreleased", () => {
      expect(semverGreaterThan("99.99.99", UNRELEASED_VERSION)).toBe(false)
    })

    test("handles real-world version comparison", () => {
      expect(semverGreaterThan("0.9.0", "0.8.10")).toBe(true)
      expect(semverGreaterThan("0.9.1", "0.9.0")).toBe(true)
      expect(semverGreaterThan("0.8.10", "0.8.9")).toBe(true)
      expect(semverGreaterThan("0.4.0", "0.9.2")).toBe(false)
    })
  })
})
