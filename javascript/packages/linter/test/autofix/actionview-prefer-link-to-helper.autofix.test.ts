import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { ActionViewPreferLinkToHelperRule } from "../../src/rules/actionview-prefer-link-to-helper.js"

const context = { fileName: "test.html.erb", framework: "actionview" as const }

describe("actionview-prefer-link-to-helper autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("rewrites an anchor to the text form", () => {
    const linter = new Linter(Herb, [ActionViewPreferLinkToHelperRule])
    const result = linter.autofix('<a href="<%= dashboard_path %>">Dashboard</a>', context)

    expect(result.source).toBe('<%= link_to "Dashboard", dashboard_path %>')
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("moves the other attributes into the options", () => {
    const linter = new Linter(Herb, [ActionViewPreferLinkToHelperRule])
    const result = linter.autofix('<a href="<%= post_path(@post) %>" class="btn" data-turbo-method="delete" aria-label="Delete">Delete</a>', context)

    expect(result.source).toBe('<%= link_to "Delete", post_path(@post), class: "btn", data: { turbo_method: "delete" }, aria: { label: "Delete" } %>')
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("interpolates ERB inside an attribute value", () => {
    const linter = new Linter(Herb, [ActionViewPreferLinkToHelperRule])
    const result = linter.autofix('<a href="<%= root_path %>" class="btn <%= extra %>">Home</a>', context)

    expect(result.source).toBe('<%= link_to "Home", root_path, class: "btn #{extra}" %>')
  })

  test("rewrites an href built from a plain expression", () => {
    const linter = new Linter(Herb, [ActionViewPreferLinkToHelperRule])
    const result = linter.autofix('<a href="<%= @user.avatar_url %>">Avatar</a>', context)

    expect(result.source).toBe('<%= link_to "Avatar", @user.avatar_url %>')
  })

  test("rewrites to the block form and leaves the content untouched", () => {
    const input = dedent`
      <div>
        <a href="<%= post_path(@post) %>">
          <span class="icon"></span>
          Read more
        </a>
      </div>
    `

    const expected = dedent`
      <div>
        <%= link_to post_path(@post) do %>
          <span class="icon"></span>
          Read more
        <% end %>
      </div>
    `

    const linter = new Linter(Herb, [ActionViewPreferLinkToHelperRule])
    const result = linter.autofix(input, context)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("rewrites an empty anchor to the block form", () => {
    const linter = new Linter(Herb, [ActionViewPreferLinkToHelperRule])
    const result = linter.autofix('<a href="<%= dashboard_path %>"></a>', context)

    expect(result.source).toBe('<%= link_to dashboard_path do %><% end %>')
  })

  test("fixes every anchor in the file", () => {
    const input = dedent`
      <nav>
        <a href="<%= dashboard_path %>">Dashboard</a>
        <a href="<%= settings_path %>">Settings</a>
        <a href="/about">About</a>
      </nav>
    `

    const expected = dedent`
      <nav>
        <%= link_to "Dashboard", dashboard_path %>
        <%= link_to "Settings", settings_path %>
        <a href="/about">About</a>
      </nav>
    `

    const linter = new Linter(Herb, [ActionViewPreferLinkToHelperRule])
    const result = linter.autofix(input, context)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("fixes one offense at a time", () => {
    const input = dedent`
      <nav>
        <a href="<%= dashboard_path %>">Dashboard</a>
        <a href="<%= settings_path %>">Settings</a>
      </nav>
    `

    const expected = dedent`
      <nav>
        <%= link_to "Dashboard", dashboard_path %>
        <a href="<%= settings_path %>">Settings</a>
      </nav>
    `

    const linter = new Linter(Herb, [ActionViewPreferLinkToHelperRule])
    const lintResult = linter.lint(input, context)
    const result = linter.autofix(input, context, [lintResult.offenses[0]])

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("escapes a double quote in an attribute value", () => {
    const linter = new Linter(Herb, [ActionViewPreferLinkToHelperRule])
    const result = linter.autofix(`<a href="<%= root_path %>" title='He said "hi"'>Home</a>`, context)

    expect(result.source).toBe(`<%= link_to "Home", root_path, title: "He said \\"hi\\"" %>`)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("reports an attribute it cannot represent without fixing it", () => {
    const input = '<a href="<%= root_path %>" title="a &amp; b">Home</a>'

    const linter = new Linter(Herb, [ActionViewPreferLinkToHelperRule])
    const result = linter.autofix(input, context)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(1)
  })

  test("does not fix a valueless attribute", () => {
    const input = '<a href="<%= root_path %>" download>File</a>'

    const linter = new Linter(Herb, [ActionViewPreferLinkToHelperRule])
    const result = linter.autofix(input, context)

    expect(result.source).toBe(input)
    expect(result.unfixed).toHaveLength(1)
  })

  test("does not fix a dynamic attribute name", () => {
    const input = '<a href="<%= root_path %>" data-<%= key %>="value">Home</a>'

    const linter = new Linter(Herb, [ActionViewPreferLinkToHelperRule])
    const result = linter.autofix(input, context)

    expect(result.source).toBe(input)
    expect(result.unfixed).toHaveLength(1)
  })

  test("does not fix when the framework is not Action View", () => {
    const input = '<a href="<%= dashboard_path %>">Dashboard</a>'

    const linter = new Linter(Herb, [ActionViewPreferLinkToHelperRule])
    const result = linter.autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("leaves no offenses behind", () => {
    const input = dedent`
      <nav>
        <a href="<%= dashboard_path %>" class="btn">Dashboard</a>
        <a href="<%= post_path(@post) %>">
          <span class="icon"></span>
          Read more
        </a>
      </nav>
    `

    const linter = new Linter(Herb, [ActionViewPreferLinkToHelperRule])
    const result = linter.autofix(input, context)

    expect(linter.lint(result.source, context).offenses).toHaveLength(0)
  })

  test("is idempotent", () => {
    const input = '<a href="<%= dashboard_path %>" class="btn">Dashboard</a>'

    const linter = new Linter(Herb, [ActionViewPreferLinkToHelperRule])
    const once = linter.autofix(input, context)
    const twice = linter.autofix(once.source, context)

    expect(twice.source).toBe(once.source)
    expect(twice.fixed).toHaveLength(0)
  })

  test("does not introduce parse errors", () => {
    const input = dedent`
      <nav>
        <a href="<%= dashboard_path %>" class="btn" data-turbo-method="delete">Dashboard</a>
        <a href="<%= post_path(@post) %>">
          <span class="icon"></span>
          Read more
        </a>
        <a href="<%= root_path %>"></a>
      </nav>
    `

    const linter = new Linter(Herb, [ActionViewPreferLinkToHelperRule])
    const result = linter.autofix(input, context)

    expect(Herb.parse(result.source).value.recursiveErrors()).toHaveLength(0)
  })
})
