import { describe, test, expect } from "vitest"

import styles from "../src/runtime/panel.css"

const CHROME_PREFIX = "herb-dev-tools-"

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, " ")
}

function classesIn(css: string): string[] {
  const withoutBodies = stripComments(css).replace(/\{[^{}]*\}/g, "{}")
  const found = withoutBodies.match(/\.[A-Za-z_][A-Za-z0-9_-]*/g) ?? []

  return [...new Set(found.map(name => name.slice(1)))].sort()
}

describe("runtime panel stylesheet", () => {
  test("prefixes every class it owns", () => {
    const foreign = classesIn(styles).filter(name => !name.startsWith(CHROME_PREFIX))

    expect(foreign).toEqual([])
  })

  test("owns more than a handful of prefixed classes", () => {
    const owned = classesIn(styles).filter(name => name.startsWith(CHROME_PREFIX))

    expect(owned.length).toBeGreaterThan(30)
  })

  test("styles no class emitted by the highlighter", () => {
    for (const name of classesIn(styles)) {
      expect(name.startsWith("herb-ansi")).toBe(false)
      expect(name.startsWith("herb-diff")).toBe(false)
      expect(name.startsWith("herb-line")).toBe(false)
      expect(name.startsWith("herb-token")).toBe(false)
    }
  })

  test("keeps the abbreviated prefix out of the stylesheet entirely", () => {
    expect(styles).not.toContain("hdt-")
  })

  test("never uppercases the product name", () => {
    expect(styles).not.toMatch(/text-transform\s*:\s*uppercase/)
  })

  test("never scroll locks the host page", () => {
    expect(styles).not.toMatch(/^\s*(body|html)\b[^{]*\{/m)
  })
})
