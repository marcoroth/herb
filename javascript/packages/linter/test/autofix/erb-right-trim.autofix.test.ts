import dedent from "dedent"

import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { ERBRightTrimRule } from "../../src/rules/erb-right-trim.js"

describe("erb-right-trim autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("when the erb tag close with %>", () => {
    const input = dedent`
      <h1>
        <%= title %>
      </h1>
    `

    const linter = new Linter(Herb, [ERBRightTrimRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("when output erb tag closes with -%>", () => {
    const input = dedent`
      <h1>
        <%= title -%>
      </h1>
    `

    const linter = new Linter(Herb, [ERBRightTrimRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("when non-output tag uses -%>", () => {
    const input = dedent`
      <% if condition -%>
        <p>Content</p>
      <% elsif other_condition -%>
        <p>Content</p>
      <% elsif yet_another_condition -%>
        <p>Content</p>
      <% else -%>
        <p>Content</p>
      <% end -%>
    `

    const linter = new Linter(Herb, [ERBRightTrimRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("when the erb tag close with =%>", () => {
    const input = dedent`
      <h1>
        <%= title =%>
      </h1>
    `

    const expected = dedent`
      <h1>
        <%= title -%>
      </h1>
    `

    const linter = new Linter(Herb, [ERBRightTrimRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("when an if block uses =%>", () => {
    const input = dedent`
      <% if condition =%>
        <p>Content</p>
      <% end =%>
    `

    const expected = dedent`
      <% if condition -%>
        <p>Content</p>
      <% end -%>
    `

    const linter = new Linter(Herb, [ERBRightTrimRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("when a loop uses =%>", () => {
    const input = dedent`
      <% items.each do |item| =%>
        <li><%= item %></li>
      <% end %>
    `

    const expected = dedent`
      <% items.each do |item| -%>
        <li><%= item %></li>
      <% end %>
    `

    const linter = new Linter(Herb, [ERBRightTrimRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("when multiple lines use =%>", () => {
    const input = dedent`
      <%= first =%>
      <%= second =%>
      <%= third =%>
    `

    const expected = dedent`
      <%= first -%>
      <%= second -%>
      <%= third -%>
    `

    const linter = new Linter(Herb, [ERBRightTrimRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(3)
    expect(result.unfixed).toHaveLength(0)
  })

  test("when mixed valid and invalid syntax is used", () => {
    const input = dedent`
      <%= valid %>
      <%= invalid_trim =%>
      <%= valid_trim -%>
      <%= another_invalid =%>
    `

    const expected = dedent`
      <%= valid %>
      <%= invalid_trim -%>
      <%= valid_trim -%>
      <%= another_invalid -%>
    `

    const linter = new Linter(Herb, [ERBRightTrimRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("when silent ERB uses =%>", () => {
    const input = dedent`
      <% silent_operation =%>
    `

    const expected = dedent`
      <% silent_operation -%>
    `

    const linter = new Linter(Herb, [ERBRightTrimRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("handles =%> in nested structures", () => {
    const input = dedent`
      <% if outer_condition =%>
        <% if inner_condition =%>
          <p>Nested content</p>
        <% end %>
      <% end %>
    `

    const expected = dedent`
      <% if outer_condition -%>
        <% if inner_condition -%>
          <p>Nested content</p>
        <% end %>
      <% end %>
    `

    const linter = new Linter(Herb, [ERBRightTrimRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("<%- with -%>", () => {
    const input = dedent`
      <%- something -%>
    `

    const linter = new Linter(Herb, [ERBRightTrimRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("<%- with -%> in if/end", () => {
    const input = dedent`
      <%- if true -%>
        Something
      <%- end -%>
    `

    const linter = new Linter(Herb, [ERBRightTrimRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })
})
