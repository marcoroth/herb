import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { classifyDefault, STATE_DEFAULT_KINDS } from "@herb-tools/client/directives"

import type { Node } from "@herb-tools/core"

const DEFAULTS = [
  "true",
  "false",
  "0",
  "-12",
  "0xff",
  "1.5",
  "1e3",
  '""',
  '"hello"',
  "'single'",
  ":name",
  ":\"quoted\"",
  "nil",
  "[1, 2]",
  "{ a: 1 }",
  "total",
  "user.name",
  "current_user.admin?",
  "params[:sort]",
]

function directiveKinds(source: string): Record<string, string> {
  const result = Herb.parse(source, { herb_directives: true })
  const found: Record<string, string> = {}

  const walk = (node: Node | null): void => {
    if (!node) return

    for (const state of ((node as never as { states?: { name?: { value: string }, kind: string }[] }).states) ?? []) {
      if (state.name) found[state.name.value] = state.kind
    }

    for (const child of ((node as never as { children?: Node[] }).children) ?? []) walk(child)
  }

  walk(result.value)

  return found
}

describe("the state kind vocabulary", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("the parser only ever reports a kind the shared definition knows", () => {
    const source = `<%# herb:state (${DEFAULTS.map((value, index) => `state${index}: ${value}`).join(", ")}) %>`
    const kinds = Object.values(directiveKinds(source))

    expect(kinds).toHaveLength(DEFAULTS.length)

    for (const kind of kinds) {
      expect(STATE_DEFAULT_KINDS).toContain(kind)
    }
  })

  test("the TypeScript classifier agrees with the parser on every default", () => {
    const source = `<%# herb:state (${DEFAULTS.map((value, index) => `state${index}: ${value}`).join(", ")}) %>`
    const kinds = directiveKinds(source)

    const parsed = DEFAULTS.map((value, index) => [value, kinds[`state${index}`]])
    const classified = DEFAULTS.map((value) => [value, classifyDefault(value)])

    expect(classified).toEqual(parsed)
  })

  test("a missing default reports the kind the shared definition names for it", () => {
    const kinds = directiveKinds("<%# herb:state (open:) %>")

    expect(kinds).toEqual({ open: "missing" })
    expect(classifyDefault("")).toBe("missing")
  })
})
