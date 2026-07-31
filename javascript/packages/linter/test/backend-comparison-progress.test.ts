import { describe, test, expect } from "vitest"

import { ComparisonProgress } from "../src/backend-comparison.js"
import { version } from "../package.json"

const CLEAR_LINE = "\r[K"

describe("ComparisonProgress", () => {
  test("emits one line per whole percent when not interactive", () => {
    const lines: string[] = []
    const progress = new ComparisonProgress(540, line => lines.push(line), false)

    for (let index = 0; index < 540; index++) progress.advance()

    expect(lines).toHaveLength(101)
    expect(lines[0]).toContain("[1/540 (0%)]")
    expect(lines.at(-1)).toContain("(100%)")
  })

  test("redraws in place on every percent change when interactive", () => {
    const writes: string[] = []
    const progress = new ComparisonProgress(540, text => writes.push(text), true)

    for (let index = 0; index < 540; index++) progress.advance()

    const redraws = writes.filter(write => write.startsWith(CLEAR_LINE) && write.length > CLEAR_LINE.length)

    expect(redraws.length).toBeGreaterThanOrEqual(100)
    expect(redraws.every(write => write.includes(`v${version}`))).toBe(true)
    expect(redraws.at(-1)).toContain("100%")
    expect(redraws.at(-1)).toContain("540/540")
  })

  test("clears the line on finish when interactive", () => {
    const writes: string[] = []
    const progress = new ComparisonProgress(1, text => writes.push(text), true)

    progress.finish()

    expect(writes).toEqual([CLEAR_LINE])
  })

  test("writes nothing on finish when not interactive", () => {
    const writes: string[] = []
    const progress = new ComparisonProgress(1, text => writes.push(text), false)

    progress.finish()

    expect(writes).toEqual([])
  })
})
