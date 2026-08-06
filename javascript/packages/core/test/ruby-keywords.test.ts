import { describe, it, expect } from "vitest"

import { RUBY_KEYWORDS, isRubyKeyword } from "../src/ruby-keywords.js"

describe("RUBY_KEYWORDS", () => {
  it("contains the control flow keywords", () => {
    for (const keyword of ["if", "unless", "else", "elsif", "end", "case", "when", "while", "until"]) {
      expect(isRubyKeyword(keyword)).toBe(true)
    }
  })

  it("contains the keywords a highlighter tends to miss", () => {
    for (const keyword of ["alias", "undef", "redo", "defined?", "retry", "ensure", "BEGIN", "END"]) {
      expect(isRubyKeyword(keyword)).toBe(true)
    }
  })

  it("contains the special literals", () => {
    for (const keyword of ["nil", "true", "false", "self", "__FILE__", "__LINE__", "__ENCODING__"]) {
      expect(isRubyKeyword(keyword)).toBe(true)
    }
  })

  it("does not contain methods that read like keywords", () => {
    for (const method of ["raise", "puts", "require", "loop", "lambda", "proc", "new", "attr_reader"]) {
      expect(isRubyKeyword(method)).toBe(false)
    }
  })

  it("does not contain ordinary local variable names", () => {
    for (const name of ["user", "event", "title", "count", "form", "tag"]) {
      expect(isRubyKeyword(name)).toBe(false)
    }
  })

  it("is case sensitive", () => {
    expect(isRubyKeyword("End")).toBe(false)
    expect(isRubyKeyword("Class")).toBe(false)
    expect(isRubyKeyword("END")).toBe(true)
  })

  it("exposes the set directly", () => {
    expect(RUBY_KEYWORDS.has("def")).toBe(true)
    expect(RUBY_KEYWORDS.size).toBe(41)
  })
})
