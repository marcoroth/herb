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
    const result = Herb.parse(html)
    const linter = new Linter([ERBRequireWhitespaceRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.messages).toHaveLength(0)
  })

  it("should require a space after <% and before %> in ERB tags", () => {
    const html = dedent`
      <%if true%>
      <% end %>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBRequireWhitespaceRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.messages).toHaveLength(2)
  })

  it("should require a space after <%= and before %> in ERB output tags", () => {
    const html = dedent`
      <%=user.name%>
      <%= user.name %>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBRequireWhitespaceRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.messages).toHaveLength(2)
  })

  it("should report errors for only missing opening whitespace", () => {
    const html = dedent`
      <%if user %>
        Hello, user.
      <% end %>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBRequireWhitespaceRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toMatch(/after opening tag/i)
  })

  it("should report errors for only missing closing whitespace", () => {
    const html = dedent`
      <% if admin%>
        Hello, admin.
      <% end %>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBRequireWhitespaceRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toMatch(/before closing tag/i)
  })

  it("should report multiple errors for multiple violations", () => {
    const html = dedent`
      <%=user.name%>
      <%if admin%>
        Hello, admin.
      <%end%>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBRequireWhitespaceRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(6)
    expect(lintResult.messages).toHaveLength(6)
  })

  it("should not report for non-ERB content", () => {
    const html = dedent`
      <div>Hello</div>
      <p>World</p>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBRequireWhitespaceRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.messages).toHaveLength(0)
  })

  it("should handle mixed correct and incorrect ERB tags", () => {
    const html = dedent`
      <%= user.name %>
      <%=user.email%>
      <% if admin %>
        <h1>Hello, admin.</h1>
      <%end%>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBRequireWhitespaceRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(4)
    expect(lintResult.messages).toHaveLength(4)
  })

  it("should handle empty erb tags", () => {
    const html = dedent`
      <% %>
      <%= %>
      <% if true %> <% end %>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBRequireWhitespaceRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.messages).toHaveLength(0)
  })
})
