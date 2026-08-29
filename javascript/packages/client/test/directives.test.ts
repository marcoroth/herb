import { describe, test, expect } from "vitest"
import { classifyDefault, classifyDerivedDefault, mentionsAnyState } from "../src/directives"

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

describe("classifyDerivedDefault", () => {
  const declared = new Map([["draft", "string"], ["count", "integer"], ["open", "boolean"]])

  test("derives a boolean from a predicate the state kind answers", () => {
    expect(classifyDerivedDefault("draft.blank?", declared)).toEqual({ kind: "boolean", condition: ["draft", null, "blank"], sources: ["draft"] })
    expect(classifyDerivedDefault("draft.present?", declared)).toEqual({ kind: "boolean", condition: ["draft", null, "present"], sources: ["draft"] })
    expect(classifyDerivedDefault("draft.empty?", declared)).toEqual({ kind: "boolean", condition: ["draft", '""'], sources: ["draft"] })
    expect(classifyDerivedDefault("count.zero?", declared)).toEqual({ kind: "boolean", condition: ["count", "0"], sources: ["count"] })
    expect(classifyDerivedDefault("count.one?", declared)).toEqual({ kind: "boolean", condition: ["count", "1"], sources: ["count"] })
    expect(classifyDerivedDefault("open.nil?", declared)).toEqual({ kind: "boolean", condition: ["open", "nil"], sources: ["open"] })
  })

  test("refuses a predicate the state kind cannot answer", () => {
    expect(classifyDerivedDefault("count.empty?", declared)).toBe("mixed")
    expect(classifyDerivedDefault("count.blank?", declared)).toBe("mixed")
    expect(classifyDerivedDefault("draft.zero?", declared)).toBe("mixed")
  })

  test("negates the condition it wraps", () => {
    expect(classifyDerivedDefault("!open", declared)).toEqual({ kind: "boolean", condition: ["open", null, "falsy"], sources: ["open"] })
    expect(classifyDerivedDefault("!open?", declared)).toEqual({ kind: "boolean", condition: ["open", null, "falsy"], sources: ["open"] })
    expect(classifyDerivedDefault("!!open", declared)).toEqual({ kind: "boolean", condition: ["open", null], sources: ["open"] })
    expect(classifyDerivedDefault("!draft.blank?", declared)).toEqual({ kind: "boolean", condition: ["draft", null, "present"], sources: ["draft"] })
    expect(classifyDerivedDefault("!count.zero?", declared)).toEqual({ kind: "boolean", condition: ["count", "0", "!="], sources: ["count"] })
    expect(classifyDerivedDefault('!(draft == "hi")', declared)).toEqual({ kind: "boolean", condition: ["draft", '"hi"', "!="], sources: ["draft"] })
    expect(classifyDerivedDefault("!(count > 3)", declared)).toEqual({ kind: "boolean", condition: ["count", "3", "<="], sources: ["count"] })
  })

  test("distributes a negated combination over its parts", () => {
    expect(classifyDerivedDefault("!(open && draft.blank?)", declared)).toEqual({
      kind: "boolean",
      condition: { any: [["open", null, "falsy"], ["draft", null, "present"]] },
      sources: ["open", "draft"],
    })

    expect(classifyDerivedDefault("!(open || count.zero?)", declared)).toEqual({
      kind: "boolean",
      condition: { all: [["open", null, "falsy"], ["count", "0", "!="]] },
      sources: ["open", "count"],
    })
  })

  test("reads to_s on a state of any kind", () => {
    expect(classifyDerivedDefault("count.to_s", declared)).toEqual({ kind: "string", condition: ["count", null, null, "to_s"], sources: ["count"] })
    expect(classifyDerivedDefault("open.to_s", declared)).toEqual({ kind: "string", condition: ["open", null, null, "to_s"], sources: ["open"] })
    expect(classifyDerivedDefault('count.to_s == "3"', declared)).toEqual({ kind: "boolean", condition: ["count", '"3"', "==", "to_s"], sources: ["count"] })
  })

  test("stays out of expressions that are not predicates", () => {
    expect(classifyDerivedDefault("draft.upcase", declared)).toBe("mixed")
    expect(classifyDerivedDefault("other.blank?", declared)).toBeNull()
  })
})
