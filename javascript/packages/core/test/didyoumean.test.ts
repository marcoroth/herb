import { describe, test, expect } from "vitest"
import { didyoumean, didyoumeanRanked } from "../src/didyoumean"

describe("didyoumean", () => {
  test("returns the closest match", () => {
    const result = didyoumean("speling", ["spelling", "writing", "reading"])
    expect(result).toBe("spelling")
  })

  test("returns null for empty list", () => {
    const result = didyoumean("test", [])
    expect(result).toBeNull()
  })

  test("is case insensitive", () => {
    const result = didyoumean("SPELING", ["spelling", "WRITING", "reading"])
    expect(result).toBe("spelling")
  })

  test("returns closest match when multiple options exist", () => {
    const result = didyoumean("helo", ["hello", "help", "world"])
    expect(result).toBe("hello")
  })

  test("respects threshold - returns match within threshold", () => {
    const result = didyoumean("speling", ["spelling", "writing", "reading"], 2)
    expect(result).toBe("spelling")
  })

  test("respects threshold - returns null when closest match exceeds threshold", () => {
    const result = didyoumean("xyz", ["spelling", "writing", "reading"], 2)
    expect(result).toBeNull()
  })

  test("returns match when threshold equals distance", () => {
    const result = didyoumean("speling", ["spelling"], 1)
    expect(result).toBe("spelling")
  })

  test("returns exact match with distance 0", () => {
    const result = didyoumean("spelling", ["spelling", "writing", "reading"])
    expect(result).toBe("spelling")
  })
})

describe("didyoumeanRanked", () => {
  test("returns all items ranked by distance", () => {
    const results = didyoumeanRanked("speling", ["spelling", "writing", "reading"])
    expect(results).toHaveLength(3)
    expect(results[0].item).toBe("spelling")
    expect(results[0].score).toBeLessThan(results[1].score)
    expect(results[1].score).toBeLessThanOrEqual(results[2].score)
  })

  test("returns empty array for empty list", () => {
    const results = didyoumeanRanked("test", [])
    expect(results).toEqual([])
  })

  test("is case insensitive", () => {
    const results = didyoumeanRanked("SPELING", ["spelling", "WRITING", "reading"])
    expect(results[0].item).toBe("spelling")
  })

  test("includes scores in results", () => {
    const results = didyoumeanRanked("hello", ["hello", "helo", "help"])
    expect(results[0].score).toBe(0)
    expect(results[1].score).toBeGreaterThan(0)
    expect(results[2].score).toBeGreaterThan(0)
  })

  test("respects threshold - returns only matches within threshold", () => {
    const results = didyoumeanRanked("speling", ["spelling", "writing", "reading"], 2)
    expect(results).toHaveLength(1)
    expect(results[0].item).toBe("spelling")
  })

  test("respects threshold - returns empty array when no matches within threshold", () => {
    const results = didyoumeanRanked("xyz", ["spelling", "writing", "reading"], 1)
    expect(results).toEqual([])
  })

  test("returns all matches when threshold is not provided", () => {
    const results = didyoumeanRanked("test", ["best", "rest", "fest", "nest"])
    expect(results).toHaveLength(4)
  })

  test("maintains sorted order by score", () => {
    const results = didyoumeanRanked("abc", ["abc", "abcd", "abcde", "xyz"])

    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i + 1].score)
    }
  })
})
