import { describe, test, expect } from "vitest"
import { deepMerge } from "../src/merge.js"

describe("deepMerge", () => {
  test("merges simple objects", () => {
    const target = { a: 1, b: 2 }
    const source = { b: 3, c: 4 }

    const result = deepMerge(target, source)

    expect(result).toEqual({ a: 1, b: 3, c: 4 })
  })

  test("merges nested objects", () => {
    const target = { a: { x: 1, y: 2 }, b: 3 }
    const source = { a: { y: 20, z: 30 } }

    const result = deepMerge(target, source)

    expect(result).toEqual({ a: { x: 1, y: 20, z: 30 }, b: 3 })
  })

  test("does not mutate target object", () => {
    const target = { a: 1, b: { c: 2 } }
    const source = { b: { c: 3 } }

    const result = deepMerge(target, source)

    expect(target.b.c).toBe(2)
    expect(result.b.c).toBe(3)
  })

  test("handles arrays by replacing them", () => {
    const target = { arr: [1, 2, 3] }
    const source = { arr: [4, 5] }

    const result = deepMerge(target, source)

    expect(result.arr).toEqual([4, 5])
  })

  test("skips undefined values in source", () => {
    const target = { a: 1, b: 2 }
    const source = { a: undefined, c: 3 }

    const result = deepMerge(target, source)

    expect(result).toEqual({ a: 1, b: 2, c: 3 })
  })

  test("handles null values", () => {
    const target = { a: 1, b: 2 }
    const source = { a: null }

    const result = deepMerge(target, source)

    expect(result).toEqual({ a: null, b: 2 })
  })

  test("merges deeply nested objects", () => {
    const target = {
      linter: {
        enabled: true,
        rules: {
          "rule-1": { enabled: true, severity: "error" },
          "rule-2": { enabled: false }
        }
      }
    }

    const source = {
      linter: {
        rules: {
          "rule-1": { enabled: false },
          "rule-3": { enabled: true }
        }
      }
    }

    const result = deepMerge(target, source)

    expect(result).toEqual({
      linter: {
        enabled: true,
        rules: {
          "rule-1": { enabled: false, severity: "error" },
          "rule-2": { enabled: false },
          "rule-3": { enabled: true }
        }
      }
    })
  })

  test("handles empty source object", () => {
    const target = { a: 1, b: 2 }
    const source = {}

    const result = deepMerge(target, source)

    expect(result).toEqual({ a: 1, b: 2 })
  })

  test("handles empty target object", () => {
    const target = {}
    const source = { a: 1, b: 2 }

    const result = deepMerge(target, source)

    expect(result).toEqual({ a: 1, b: 2 })
  })

  test("overwrites primitives with objects", () => {
    const target = { a: 1 }
    const source = { a: { x: 10 } }

    const result = deepMerge(target, source as any)

    expect(result).toEqual({ a: { x: 10 } })
  })

  test("overwrites objects with primitives", () => {
    const target = { a: { x: 10 } }
    const source = { a: 5 }

    const result = deepMerge(target, source as any)

    expect(result).toEqual({ a: 5 })
  })

  test("creates new object reference for nested objects", () => {
    const target = { a: { x: 1 } }
    const source = { a: { y: 2 } }

    const result = deepMerge(target, source)

    expect(result.a).not.toBe(target.a)
    expect(result.a).not.toBe(source.a)
  })

  test("creates new array reference", () => {
    const target = { arr: [1, 2] }
    const sourceArr = [3, 4]
    const source = { arr: sourceArr }

    const result = deepMerge(target, source)

    expect(result.arr).not.toBe(sourceArr)
    expect(result.arr).toEqual([3, 4])
  })
})
