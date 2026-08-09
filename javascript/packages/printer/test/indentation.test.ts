import { describe, test, expect } from "vitest"

import { convertIndentation } from "../src/indentation.js"

describe("convertIndentation", () => {
  test("converts leading spaces to tabs", () => {
    const source = "  this is a line\n    indented twice\n"

    expect(convertIndentation(source, 2, "tabs")).toBe("\tthis is a line\n\t\tindented twice\n")
  })

  test("converts leading tabs to spaces", () => {
    const source = "\tthis is a line\n\t\tindented twice\n"

    expect(convertIndentation(source, 2, "spaces")).toBe("  this is a line\n    indented twice\n")
  })

  test("leaves tabs-only source unchanged when converting to tabs", () => {
    const source = "\tthis is a line\n\t\tanother line\n"

    expect(convertIndentation(source, 2, "tabs")).toBe(source)
  })

  test("leaves spaces-only source unchanged when converting to spaces", () => {
    const source = "  this is a line\n    another line\n"

    expect(convertIndentation(source, 2, "spaces")).toBe(source)
  })

  test("leaves remainder spaces after converting a non-multiple indent to tabs", () => {
    const source = "   this is a line\n"

    expect(convertIndentation(source, 2, "tabs")).toBe("\t this is a line\n")
  })

  test("ignores whitespace in the middle of a line", () => {
    const source = "hello\tworld\n"

    expect(convertIndentation(source, 2, "tabs")).toBe(source)
  })

  test("respects a custom indentWidth", () => {
    const source = "    this is a line\n        indented twice\n"

    expect(convertIndentation(source, 4, "tabs")).toBe("\tthis is a line\n\t\tindented twice\n")
  })
})
