import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { ERBStrictLocalsFirstLineRule } from "../../src/rules/erb-strict-locals-first-line.js"

describe("erb-strict-locals-first-line autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("adds blank line after strict locals on line 1", () => {
    const input = dedent`
      <%# locals: (user:) %>
      <div><%= user.name %></div>
    `
    const expected = dedent`
      <%# locals: (user:) %>

      <div><%= user.name %></div>
    `

    const linter = new Linter(Herb, [ERBStrictLocalsFirstLineRule])
    const result = linter.autofix(input, { fileName: "_partial.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("moves strict locals after a leading blank line to first line", () => {
    const input = "\n<%# locals: (user:) %>\n\n<div><%= user.name %></div>\n"
    const expected = "<%# locals: (user:) %>\n\n<div><%= user.name %></div>\n"

    const linter = new Linter(Herb, [ERBStrictLocalsFirstLineRule])
    const result = linter.autofix(input, { fileName: "_partial.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("moves strict locals after other top-level content to first line", () => {
    const input = dedent`
      <%# This is a comment %>
      <%# locals: (user:) %>

      <div><%= user.name %></div>
    `

    const linter = new Linter(Herb, [ERBStrictLocalsFirstLineRule])
    const result = linter.autofix(input, { fileName: "_partial.html.erb" })

    expect(result.source).toContain("<%# locals: (user:) %>")
    expect(result.source).toMatch(/^<%# locals: \(user:\) %>/)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not autofix strict locals nested inside HTML elements", () => {
    const input = dedent`
      <div class="card">
        <%# locals: (user:) %>
        <%= user.name %>
      </div>
    `

    const linter = new Linter(Herb, [ERBStrictLocalsFirstLineRule])
    const result = linter.autofix(input, { fileName: "_partial.html.erb" })

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(1)
  })

  test("adds blank line after strict locals when followed by another comment", () => {
    const input = dedent`
      <%# locals: (user:) %>
      <%# Some helper comment %>

      <div><%= user.name %></div>
    `
    const expected = dedent`
      <%# locals: (user:) %>

      <%# Some helper comment %>

      <div><%= user.name %></div>
    `

    const linter = new Linter(Herb, [ERBStrictLocalsFirstLineRule])
    const result = linter.autofix(input, { fileName: "_partial.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not modify files that already comply", () => {
    const input = dedent`
      <%# locals: (user:) %>

      <div><%= user.name %></div>
    `

    const linter = new Linter(Herb, [ERBStrictLocalsFirstLineRule])
    const result = linter.autofix(input, { fileName: "_partial.html.erb" })

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not modify non-partial files", () => {
    const input = dedent`
      <%# locals: (user:) %>
      <div><%= user.name %></div>
    `

    const linter = new Linter(Herb, [ERBStrictLocalsFirstLineRule])
    const result = linter.autofix(input, { fileName: "show.html.erb" })

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })
})
