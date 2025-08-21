import { describe, it, beforeAll, expect } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import dedent from "dedent";

import { Linter } from "../../src/linter";
import { ERBRequireWhitespaceRule } from "../../src/rules/erb-require-whitespace-inside-tags";

describe("erb-require-whitespace-inside-tags", () => {

  beforeAll(async () => {
    await Herb.load()
  })

  it("should not report for correct whitespace in ERB tags", () => {
    const html = dedent`
      <% if admin %>
        Hello, admin.
      <% end %>
    `
    
    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  it("should require a space after <% and before %> in ERB tags", () => {
    const html = dedent`
      <%if true%>
      <% end %>
    `
    
    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(2)
  })

  it("should require a space after <%= and before %> in ERB output tags", () => {
    const html = dedent`
      <%=user.name%>
      <%= user.name %>
    `
    
    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(2)
  })

  it("should report errors for only missing opening whitespace", () => {
    const html = dedent`
      <%if user %>
        Hello, user.
      <% end %>
    `
    
    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toMatch(/Add whitespace after/i)
  })

  it("should report errors for only missing closing whitespace", () => {
    const html = dedent`
      <% if admin%>
        Hello, admin.
      <% end %>
    `
    
    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toMatch(/Add whitespace before/i)
  })

  it("should report multiple errors for multiple offenses", () => {
    const html = dedent`
      <%=user.name%>
      <%if admin%>
        Hello, admin.
      <%end%>
    `
    
    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(6)
    expect(lintResult.offenses).toHaveLength(6)
  })

  it("should not report for non-ERB content", () => {
    const html = dedent`
      <div>Hello</div>
      <p>World</p>
    `
    
    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  it("should handle mixed correct and incorrect ERB tags", () => {
    const html = dedent`
      <%= user.name %>
      <%=user.email%>
      <% if admin %>
        <h1>Hello, admin.</h1>
      <%end%>
    `
    
    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(4)
    expect(lintResult.offenses).toHaveLength(4)
  })

  it("should handle empty erb tags", () => {
    const html = dedent`
      <% %>
      <%= %>
      <% if true %> <% end %>
      <%

      %>
    `
    
    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  it("should require whitespace after # in ERB comment tags", () => {
    const html = dedent`
      <%# This is a comment %>
      <%#This is a comment without spaces%>
      <%# %>
    `
    
    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.offenses).toHaveLength(2)

    expect(lintResult.offenses[0].message).toBe("Add whitespace after `<%#`.")
    expect(lintResult.offenses[1].message).toBe("Add whitespace before `%>`.")
  })

  it("should not report ERB comment tags with equals signs", () => {
    const html = dedent`
      <%#= link_to "New watch list", new_watch_list_path, class: "btn btn-ghost" %>
    `
    
    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  it("should report ERB comment tags with equals sign and no space after", () => {
    const html = dedent`
      <%#=link_to "New watch list", new_watch_list_path, class: "btn btn-ghost"%>
    `
    
    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.offenses).toHaveLength(2)

    expect(lintResult.offenses[0].message).toBe("Add whitespace after `<%#=`.")
    expect(lintResult.offenses[1].message).toBe("Add whitespace before `%>`.")
  })

  it("should not report ERB comment tags with equals followed by space", () => {
    const html = dedent`
      <%# = link_to "New watch list", new_watch_list_path, class: "btn btn-ghost" %>
    `
    
    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  it("should handle multi-line ERB comment tags", () => {
    const html = dedent`
      <%#
        This is a multi-line comment
        with multiple lines
      %>

      <%#=
        link_to "New watch list",
        new_watch_list_path,
        class: "btn btn-ghost"
      %>
    `
    
    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })
})
