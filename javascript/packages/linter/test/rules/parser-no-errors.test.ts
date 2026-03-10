import dedent from "dedent"

import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { ParserNoErrorsRule } from "../../src/rules/parser-no-errors.js"

describe("ParserNoErrorsRule", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("should not report errors for valid HTML", () => {
    const html = dedent`
      <h1>Hello World</h1>
      <p>This is a paragraph.</p>
      <div>
        <%= user.name %>
      </div>
    `
    const linter = new Linter(Herb, [ParserNoErrorsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("should report errors for mismatched tag names", () => {
    const html = dedent`
      <h2>
        Some content
      <h3>
    `
    const linter = new Linter(Herb, [ParserNoErrorsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(4)
    expect(lintResult.offenses).toHaveLength(4)
    expect(lintResult.offenses[0].rule).toBe("parser-no-errors")
    expect(lintResult.offenses[0].severity).toBe("error")

    expect(lintResult.offenses[0].message).toBe("Tag `<h3>` opened at (3:1) was never closed before the end of document. (`UNCLOSED_ELEMENT_ERROR`)")
    expect(lintResult.offenses[1].message).toBe("Tag `<h2>` opened at (1:1) was never closed before the end of document. (`UNCLOSED_ELEMENT_ERROR`)")
    expect(lintResult.offenses[2].message).toBe("Opening tag `<h2>` at (1:1) doesn't have a matching closing tag `</h2>`. (`MISSING_CLOSING_TAG_ERROR`)")
    expect(lintResult.offenses[3].message).toBe("Opening tag `<h3>` at (3:1) doesn't have a matching closing tag `</h3>`. (`MISSING_CLOSING_TAG_ERROR`)")
  })

  test("should report errors for unclosed elements", () => {
    const html = dedent`
      <div>
        <p>Some content
      </div>
    `
    const linter = new Linter(Herb, [ParserNoErrorsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(4)
    expect(lintResult.offenses).toHaveLength(4)
    expect(lintResult.offenses[0].rule).toBe("parser-no-errors")
    expect(lintResult.offenses[0].severity).toBe("error")
    expect(lintResult.offenses[0].message).toBe("Tag `<p>` opened at (2:3) was never closed before the end of document. (`UNCLOSED_ELEMENT_ERROR`)")
  })

  test("should report errors for void elements with closing tags", () => {
    const html = `<img src="test.jpg" alt="test"></img>`
    const linter = new Linter(Herb, [ParserNoErrorsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].rule).toBe("parser-no-errors")
    expect(lintResult.offenses[0].severity).toBe("error")
    expect(lintResult.offenses[0].message).toBe("`img` is a void element and should not be used as a closing tag. Use `<img>` or `<img />` instead of `</img>`. (`VOID_ELEMENT_CLOSING_TAG_ERROR`)")
  })

  test("should report errors for missing opening tags", () => {
    const html = dedent`
      Some content
      </div>
    `
    const linter = new Linter(Herb, [ParserNoErrorsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].rule).toBe("parser-no-errors")
    expect(lintResult.offenses[0].severity).toBe("error")
    expect(lintResult.offenses[0].message).toBe("Found closing tag `</div>` at (2:2) without a matching opening tag. (`MISSING_OPENING_TAG_ERROR`)")
  })

  test("should report errors for mismatched quotes in attributes", () => {
    const html = `<div class="test'></div>`
    const linter = new Linter(Herb, [ParserNoErrorsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(3)
    expect(lintResult.offenses).toHaveLength(3)
    expect(lintResult.offenses[0].rule).toBe("parser-no-errors")
    expect(lintResult.offenses[0].severity).toBe("error")
    expect(lintResult.offenses[0].message).toBe("Found `TOKEN_EOF` when expecting `TOKEN_HTML_TAG_SELF_CLOSE` at (1:24). (`UNEXPECTED_TOKEN_ERROR`)")
  })

  test("should report Ruby parse errors in ERB tags", () => {
    const html = `<%= 1 + %>`
    const linter = new Linter(Herb, [ParserNoErrorsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("parser-no-errors")
    expect(lintResult.offenses[0].severity).toBe("error")
    expect(lintResult.offenses[0].message).toBe("expect_expression_after_operator: unexpected ';'; expected an expression after the operator (`RUBY_PARSE_ERROR`)")
  })

  test("should report multiple parser errors", () => {
    const html = dedent`
      <h2>
        <p>Unclosed paragraph
      </h3>
      </div>
    `
    const linter = new Linter(Herb, [ParserNoErrorsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(4)
    expect(lintResult.offenses).toHaveLength(4)

    expect(lintResult.offenses[0].rule).toBe("parser-no-errors")
    expect(lintResult.offenses[0].severity).toBe("error")
    expect(lintResult.offenses[0].message).toBe("Tag `<p>` opened at (2:3) was never closed before the end of document. (`UNCLOSED_ELEMENT_ERROR`)")

    expect(lintResult.offenses[1].message).toBe("Tag `<h2>` opened at (1:1) was never closed before the end of document. (`UNCLOSED_ELEMENT_ERROR`)")
    expect(lintResult.offenses[2].message).toBe("Opening tag `<p>` at (2:3) closed with `</div>` at (4:2). (`TAG_NAMES_MISMATCH_ERROR`)")
    expect(lintResult.offenses[3].message).toBe("Opening tag `<p>` at (2:3) closed with `</h3>` at (3:2). (`TAG_NAMES_MISMATCH_ERROR`)")
  })

  test("should work alongside other linting rules", () => {
    const html = dedent`
      <h2>
        <% %>
      </h3>
    `
    const linter = new Linter(Herb)
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(3)
    expect(lintResult.offenses).toHaveLength(3)

    const parserErrors = lintResult.offenses.filter(offense => offense.rule === "parser-no-errors")
    const erbErrors = lintResult.offenses.filter(offense => offense.rule === "erb-no-empty-tags")

    expect(parserErrors).toHaveLength(2)
    expect(erbErrors).toHaveLength(1)

    expect(parserErrors[0].message).toBe("Tag `<h2>` opened at (1:1) was never closed before the end of document. (`UNCLOSED_ELEMENT_ERROR`)")
    expect(parserErrors[1].message).toBe("Opening tag `<h2>` at (1:1) closed with `</h3>` at (3:2). (`TAG_NAMES_MISMATCH_ERROR`)")
    expect(erbErrors[0].message).toBe("ERB tag should not be empty. Remove empty ERB tags or add content.")
  })

  test("should include error location information", () => {
    const html = dedent`
      <div>
        <h2>Content</h3>
      </div>
    `
    const linter = new Linter(Herb, [ParserNoErrorsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(4)
    expect(lintResult.offenses).toHaveLength(4)

    const offense = lintResult.offenses[0]
    expect(offense.rule).toBe("parser-no-errors")
    expect(offense.severity).toBe("error")
    expect(offense.message).toBe("Tag `<h2>` opened at (2:3) was never closed before the end of document. (`UNCLOSED_ELEMENT_ERROR`)")

    expect(offense.location).toBeDefined()
    expect(offense.location.start).toBeDefined()
    expect(offense.location.end).toBeDefined()
    expect(offense.location.start.line).toBe(3)
    expect(offense.location.start.column).toBe(6)

    expect(lintResult.offenses[1].message).toBe("Tag `<div>` opened at (1:1) was never closed before the end of document. (`UNCLOSED_ELEMENT_ERROR`)")
  })

  test("should handle the specific case from issue #359", () => {
    const html = dedent`
      <h2>Some heading content<h2>
    `
    const linter = new Linter(Herb, [ParserNoErrorsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(4)
    expect(lintResult.offenses).toHaveLength(4)

    expect(lintResult.offenses[0].rule).toBe("parser-no-errors")
    expect(lintResult.offenses[0].severity).toBe("error")
    expect(lintResult.offenses[0].message).toBe("Tag `<h2>` opened at (1:25) was never closed before the end of document. (`UNCLOSED_ELEMENT_ERROR`)")

    expect(lintResult.offenses[1].message).toBe("Tag `<h2>` opened at (1:1) was never closed before the end of document. (`UNCLOSED_ELEMENT_ERROR`)")
    expect(lintResult.offenses[2].message).toBe("Opening tag `<h2>` at (1:1) doesn't have a matching closing tag `</h2>`. (`MISSING_CLOSING_TAG_ERROR`)")
    expect(lintResult.offenses[3].message).toBe("Opening tag `<h2>` at (1:25) doesn't have a matching closing tag `</h2>`. (`MISSING_CLOSING_TAG_ERROR`)")
  })
})
