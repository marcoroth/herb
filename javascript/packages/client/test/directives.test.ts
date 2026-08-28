import { describe, test, expect } from "vitest"
import { classifyDefault, mentionsAnyState } from "../src/directives"

describe("mentionsAnyState", () => {
  test("a bare read mentions the state", () => {
    expect(mentionsAnyState("open", ["open"])).toBe(true)
    expect(mentionsAnyState("open?", ["open"])).toBe(true)
  })

  test("a negated read still mentions the state", () => {
    expect(mentionsAnyState("!open", ["open"])).toBe(true)
    expect(mentionsAnyState("!!open", ["open"])).toBe(true)
  })

  test("a longer name is not a mention", () => {
    expect(mentionsAnyState("reopen", ["open"])).toBe(false)
    expect(mentionsAnyState("open_at", ["open"])).toBe(false)
    expect(mentionsAnyState("open!", ["open"])).toBe(false)
  })
})

describe("classifyDefault", () => {
  test("classifies the literals Prism calls floats", () => {
    for (const source of ["1.0", "-1.5", "1_000.5", "1e3", "1E3", "1.5e-3", "1_0e1_0"]) {
      expect(classifyDefault(source)).toBe("float")
    }
  })

  test("classifies every integer radix Ruby accepts", () => {
    for (const source of ["0", "1", "-5", "1_000", "017", "0x1f", "0X1F", "-0x10", "0o17", "0b1010", "0d99"]) {
      expect(classifyDefault(source)).toBe("integer")
    }
  })

  test("classifies quoted and character strings", () => {
    for (const source of ['"x"', "'x'", "?a", "?\\n"]) {
      expect(classifyDefault(source)).toBe("string")
    }
  })

  test("classifies symbols", () => {
    for (const source of [":a", ':"a"', ":a?"]) {
      expect(classifyDefault(source)).toBe("symbol")
    }
  })

  test("falls back to seeded rather than guessing a kind", () => {
    for (const source of ["1r", "2i", '"a#{b}"', "%q(x)", "%(x)", "%s(a)", "1."]) {
      expect(classifyDefault(source)).toBe("seeded")
    }
  })

  test("keeps the kinds it already recognized", () => {
    expect(classifyDefault("")).toBe("missing")
    expect(classifyDefault("true")).toBe("boolean")
    expect(classifyDefault("nil")).toBe("nil")
    expect(classifyDefault("[]")).toBe("array")
    expect(classifyDefault("{ a: 1 }")).toBe("hash")
    expect(classifyDefault("open_initially")).toBe("bare")
  })
})
