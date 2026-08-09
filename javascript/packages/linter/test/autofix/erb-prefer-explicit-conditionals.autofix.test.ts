import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { ERBPreferExplicitConditionalsRule } from "../../src/rules/erb-prefer-explicit-conditionals.js"

describe("erb-prefer-explicit-conditionals autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("fixes an inline `if`", () => {
    const input = "<%= avatar_for(user) if user.avatar? %>"
    const expected = "<% if user.avatar? %><%= avatar_for(user) %><% end %>"

    const linter = new Linter(Herb, [ERBPreferExplicitConditionalsRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("fixes an inline `unless`", () => {
    const input = "<%= badge unless user.admin? %>"
    const expected = "<% unless user.admin? %><%= badge %><% end %>"

    const linter = new Linter(Herb, [ERBPreferExplicitConditionalsRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes an inline `if` inside an element", () => {
    const input = dedent`
      <div>
        <%= icon(:check) if done? %>
      </div>
    `

    const expected = dedent`
      <div>
        <% if done? %><%= icon(:check) %><% end %>
      </div>
    `

    const linter = new Linter(Herb, [ERBPreferExplicitConditionalsRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes an inline `if` in a raw output tag", () => {
    const input = "<%== markup if render_markup? %>"
    const expected = "<% if render_markup? %><%== markup %><% end %>"

    const linter = new Linter(Herb, [ERBPreferExplicitConditionalsRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes multiple inline conditionals", () => {
    const input = dedent`
      <%= icon(:check) if done? %>
      <%= badge unless user.admin? %>
    `

    const expected = dedent`
      <% if done? %><%= icon(:check) %><% end %>
      <% unless user.admin? %><%= badge %><% end %>
    `

    const linter = new Linter(Herb, [ERBPreferExplicitConditionalsRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("leaves a trimming tag closing unfixed", () => {
    const input = "<%= icon(:check) if done? -%>"

    const linter = new Linter(Herb, [ERBPreferExplicitConditionalsRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(1)
  })

  test("leaves an inline `if` wrapping a ternary unfixed", () => {
    const input = "<%= (user.admin? ? admin_badge : user_badge) if user %>"

    const linter = new Linter(Herb, [ERBPreferExplicitConditionalsRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(1)
  })

  test("fixes an inline `if` inside an attribute value", () => {
    const input = `<div class="<%= "active" if selected %>"></div>`
    const expected = `<div class="<% if selected %><%= "active" %><% end %>"></div>`

    const linter = new Linter(Herb, [ERBPreferExplicitConditionalsRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes an inline `if` in attribute position", () => {
    const input = `<a href="/" <%= 'aria-current=page' if selected %>>About</a>`
    const expected = `<a href="/" <% if selected %><%= 'aria-current=page' %><% end %>>About</a>`

    const linter = new Linter(Herb, [ERBPreferExplicitConditionalsRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })
})
