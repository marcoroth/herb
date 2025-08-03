import dedent from "dedent"

import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { ERBRequiresTrailingNewlineRule } from "../../src/rules/erb-requires-trailing-newline.js"

describe("ERBRequiresTrailingNewlineRule", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("should not report errors for files ending with a trailing newline", () => {
    const html = dedent`
      <h1>
        <%= title %>
      </h1>
    ` + '\n'

    const linter = new Linter(Herb, [ERBRequiresTrailingNewlineRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("should not report errors for single newline files", () => {
    const html = "\n"
    const linter = new Linter(Herb, [ERBRequiresTrailingNewlineRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("should not report errors for files with multiple lines ending with newline", () => {
    const html = dedent`
      <%= render partial: "header" %>
      <%= render partial: "footer" %>
    ` + '\n'

    const linter = new Linter(Herb, [ERBRequiresTrailingNewlineRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("should report errors for files without trailing newline", () => {
    const html = dedent`
      <h1>
        <%= title %>
      </h1>
    `

    const linter = new Linter(Herb, [ERBRequiresTrailingNewlineRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].rule).toBe("erb-requires-trailing-newline")
    expect(lintResult.offenses[0].message).toBe("File must end with trailing newline")
  })

  test("should report errors for single line files without newline", () => {
    const html = `<%= render partial: "header" %>`
    const linter = new Linter(Herb, [ERBRequiresTrailingNewlineRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].rule).toBe("erb-requires-trailing-newline")
    expect(lintResult.offenses[0].message).toBe("File must end with trailing newline")
  })

  test("should handle files with mixed content without trailing newline", () => {
    const html = dedent`
      <div>
        <h1><%= @title %></h1>
        <% @items.each do |item| %>
          <p><%= item.name %></p>
        <% end %>
      </div>
    `

    const linter = new Linter(Herb, [ERBRequiresTrailingNewlineRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].rule).toBe("erb-requires-trailing-newline")
    expect(lintResult.offenses[0].message).toBe("File must end with trailing newline")
  })

  test("should handle files with mixed content with trailing newline", () => {
    const html = dedent`
      <div>
        <h1><%= @title %></h1>
        <% @items.each do |item| %>
          <p><%= item.name %></p>
        <% end %>
      </div>
    ` + '\n'

    const linter = new Linter(Herb, [ERBRequiresTrailingNewlineRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("should handle ERB-only template without trailing newline", () => {
    const html = `<%= hello world %>`
    const linter = new Linter(Herb, [ERBRequiresTrailingNewlineRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].rule).toBe("erb-requires-trailing-newline")
    expect(lintResult.offenses[0].message).toBe("File must end with trailing newline")
  })

  test("should handle ERB-only template with trailing newline", () => {
    const html = `<%= hello world %>` + '\n'
    const linter = new Linter(Herb, [ERBRequiresTrailingNewlineRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("should not flag empty file", () => {
    const html = ``
    const linter = new Linter(Herb, [ERBRequiresTrailingNewlineRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("should flag empty file with whitespace", () => {
    const html = ` `
    const linter = new Linter(Herb, [ERBRequiresTrailingNewlineRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].rule).toBe("erb-requires-trailing-newline")
    expect(lintResult.offenses[0].message).toBe("File must end with trailing newline")
  })
})
