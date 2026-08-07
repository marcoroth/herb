import dedent from "dedent"

import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { ERBNoOutputControlFlowRule } from "../../src/rules/erb-no-output-control-flow.js"

describe("erb-no-output-control-flow autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("when control flow already uses non-output tags", () => {
    const input = dedent`
      <% if condition? %>
        <p>Content</p>
      <% elsif other_condition? %>
        <p>Content</p>
      <% else %>
        <p>Content</p>
      <% end %>
    `

    const linter = new Linter(Herb, [ERBNoOutputControlFlowRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("when an if block uses an output tag", () => {
    const input = dedent`
      <%= if condition? %>
        <p>Content</p>
      <% end %>
    `

    const expected = dedent`
      <% if condition? %>
        <p>Content</p>
      <% end %>
    `

    const linter = new Linter(Herb, [ERBNoOutputControlFlowRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("when an unless block uses an output tag", () => {
    const input = dedent`
      <%= unless condition? %>
        <p>Content</p>
      <% end %>
    `

    const expected = dedent`
      <% unless condition? %>
        <p>Content</p>
      <% end %>
    `

    const linter = new Linter(Herb, [ERBNoOutputControlFlowRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("when elsif, else and end use output tags", () => {
    const input = dedent`
      <% if condition? %>
        <p>Content</p>
      <%= elsif another_condition? %>
        <p>Content</p>
      <%= else %>
        <p>Content</p>
      <%= end %>
    `

    const expected = dedent`
      <% if condition? %>
        <p>Content</p>
      <% elsif another_condition? %>
        <p>Content</p>
      <% else %>
        <p>Content</p>
      <% end %>
    `

    const linter = new Linter(Herb, [ERBNoOutputControlFlowRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(3)
    expect(result.unfixed).toHaveLength(0)
  })

  test("when an iteration block uses an output tag", () => {
    const input = dedent`
      <%= items.each do |item| %>
        <li><%= item %></li>
      <% end %>
    `

    const expected = dedent`
      <% items.each do |item| %>
        <li><%= item %></li>
      <% end %>
    `

    const linter = new Linter(Herb, [ERBNoOutputControlFlowRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("preserves trim tags when fixing", () => {
    const input = dedent`
      <%= if condition? -%>
        <p>Content</p>
      <% end %>
    `

    const expected = dedent`
      <% if condition? -%>
        <p>Content</p>
      <% end %>
    `

    const linter = new Linter(Herb, [ERBNoOutputControlFlowRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("fixes nested control flow blocks", () => {
    const input = dedent`
      <% unless something? %>
        <%= if condition? %>
          <p>Content</p>
        <% end %>
      <% end %>
    `

    const expected = dedent`
      <% unless something? %>
        <% if condition? %>
          <p>Content</p>
        <% end %>
      <% end %>
    `

    const linter = new Linter(Herb, [ERBNoOutputControlFlowRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not touch output tags that are not control flow", () => {
    const input = dedent`
      <%= yield(:header) if content_for?(:header) %>
      <%= content_tag :div do %>
        <span>content</span>
      <% end %>
    `

    const linter = new Linter(Herb, [ERBNoOutputControlFlowRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })
})
