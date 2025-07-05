import dedent from "dedent"

import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { ERBNoEmptyTagsRule } from "../../src/rules/erb-no-empty-tags.js"

describe("ERBNoEmptyTagsRule", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("should not report errors for valid ERB tags with content", () => {
    const html = dedent`
      <h1>
        <%= title %>
      </h1>

      <% if user.admin? %>
        Admin tools
      <% end %>

      <% user.posts.each do |post| %>
        <p><%= post.title %></p>
      <% end %>

      <%= "" %>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBNoEmptyTagsRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("should not report errors for incomplete erb tags", () => {
    const html = dedent`
      <%
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBNoEmptyTagsRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("should not report errors for incomplete erb output tags", () => {
    const html = dedent`
      <%=
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBNoEmptyTagsRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("should report errors for completely empty ERB tags", () => {
    const html = dedent`
      <h1>
        <% %>
        <%= %>
      </h1>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBNoEmptyTagsRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(2)
    expect(lintResult.offenses[0].message).toBe("ERB tag should not be empty. Remove empty ERB tags or add content.")
    expect(lintResult.offenses[1].message).toBe("ERB tag should not be empty. Remove empty ERB tags or add content.")
  })

  test("should report errors for whitespace-only ERB tags", () => {
    const html = dedent`
      <h1>
        <%   %>
        <%=    %>
        <%
        %>
      </h1>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBNoEmptyTagsRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(3)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(3)
    lintResult.offenses.forEach(message => {
      expect(message.message).toBe("ERB tag should not be empty. Remove empty ERB tags or add content.")
    })
  })

  test("should not report errors for ERB tags with meaningful content", () => {
    const html = dedent`
      <div>
        <%= user.name %>
        <% if condition %>
        <% end %>
        <% # this is a comment %>
        <%= @variable %>
      </div>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBNoEmptyTagsRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("should handle mixed valid and invalid ERB tags", () => {
    const html = dedent`
      <div>
        <%= user.name %>
        <% %>
        <% if condition %>
        <%= %>
        <% end %>
      </div>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBNoEmptyTagsRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(2)

    lintResult.offenses.forEach(message => {
      expect(message.message).toBe("ERB tag should not be empty. Remove empty ERB tags or add content.")
    })
  })

  test("should handle empty ERB tag in attribute value", () => {
    const html = `<div class="<%= %>"></div>`
    const result = Herb.parse(html)
    const linter = new Linter([ERBNoEmptyTagsRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].message).toBe("ERB tag should not be empty. Remove empty ERB tags or add content.")
  })

  test("should handle empty ERB tag in open tag", () => {
    const html = `<div <%= %>></div>`
    const result = Herb.parse(html)
    const linter = new Linter([ERBNoEmptyTagsRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].message).toBe("ERB tag should not be empty. Remove empty ERB tags or add content.")
  })
})
