import { describe, it, expect } from "vitest"

import { RUBY_KEYWORDS, isRubyKeyword, RUBY_INTROSPECTION_METHODS, isRubyIntrospectionMethod } from "../src/ruby-keywords.js"

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

describe("RUBY_INTROSPECTION_METHODS", () => {
  it("contains the dynamic dispatch methods", () => {
    for (const method of ["send", "public_send", "__send__", "try", "try!", "method"]) {
      expect(isRubyIntrospectionMethod(method)).toBe(true)
    }
  })

  it("contains the object identity and copying methods", () => {
    for (const method of ["class", "object_id", "__id__", "dup", "clone", "freeze", "frozen", "inspect", "to_s"]) {
      expect(isRubyIntrospectionMethod(method)).toBe(true)
    }
  })

  it("contains the chaining methods", () => {
    for (const method of ["tap", "then", "yield_self"]) {
      expect(isRubyIntrospectionMethod(method)).toBe(true)
    }
  })

  it("treats every predicate and bang method as introspection", () => {
    for (const method of ["present?", "blank?", "any?", "save!", "update!"]) {
      expect(isRubyIntrospectionMethod(method)).toBe(true)
    }
  })

  it("does not contain ordinary method names", () => {
    for (const method of ["div", "span", "title", "name", "render", "sender", "to_string", "classes"]) {
      expect(isRubyIntrospectionMethod(method)).toBe(false)
    }
  })

  it("is case sensitive", () => {
    expect(isRubyIntrospectionMethod("Class")).toBe(false)
    expect(isRubyIntrospectionMethod("Send")).toBe(false)
  })

  it("matches the list in `src/util/ruby_util.c`", () => {
    expect([...RUBY_INTROSPECTION_METHODS].sort()).toEqual([
      "__id__", "__send__", "class", "clone", "dup", "freeze", "frozen", "inspect", "method",
      "object_id", "public_send", "send", "tap", "then", "to_s", "try", "try!", "yield_self",
    ])
  })
})
