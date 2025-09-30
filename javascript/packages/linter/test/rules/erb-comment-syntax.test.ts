import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { ERBCommentSyntax } from "../../src/rules/erb-comment-syntax.js"

describe("ERBCommentSyntax", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("when the ERB comment syntax is correct", () => {
    const html = dedent`
      <%# good comment %>
    `

    const linter = new Linter(Herb, [ERBCommentSyntax])
    const lintResult = linter.lint(html)

    expect(lintResult.offenses).toHaveLength(0)
  })

  test("when the ERB multi-line comment syntax is correct", () => {
    const html = dedent`
      <%
        # good comment
      %>
    `

    const linter = new Linter(Herb, [ERBCommentSyntax])
    const lintResult = linter.lint(html)

    expect(lintResult.offenses).toHaveLength(0)
  })

  test("when the ERB multi-line comment syntax is correct with multiple comment lines", () => {
    const html = dedent`
      <%
        # good comment
        # good comment
      %>
    `

    const linter = new Linter(Herb, [ERBCommentSyntax])
    const lintResult = linter.lint(html)

    expect(lintResult.offenses).toHaveLength(0)
  })

  test("when the ERB comment syntax is incorrect", () => {
    const html = dedent`
      <% # bad comment %>
    `

    const linter = new Linter(Herb, [ERBCommentSyntax])
    const lintResult = linter.lint(html)

    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].message).toBe("Use `<%#` instead of `<% #`. Ruby comments immediately after ERB tags can cause parsing issues.")
  })

  test("when the ERB comment syntax is incorrect multiple times in one file", () => {
    const html = dedent`
      <% # first bad comment %>
      <%= # second bad comment %>
    `

    const linter = new Linter(Herb, [ERBCommentSyntax])
    const lintResult = linter.lint(html)

    expect(lintResult.offenses).toHaveLength(2)
    expect(lintResult.offenses[0].message).toBe("Use `<%#` instead of `<% #`. Ruby comments immediately after ERB tags can cause parsing issues.")
    expect(lintResult.offenses[1].message).toBe("Use `<%#` instead of `<%= #`. Ruby comments immediately after ERB tags can cause parsing issues.")
  })
})
