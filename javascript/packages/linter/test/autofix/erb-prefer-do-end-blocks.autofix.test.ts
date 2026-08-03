import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { ERBPreferDoEndBlocksRule } from "../../src/rules/erb-prefer-do-end-blocks.js"

describe("erb-prefer-do-end-blocks autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("replaces the braces of a block spanning multiple ERB tags", () => {
    const input = dedent`
      <% @users.each { |user| %>
        <p><%= user.name %></p>
      <% } %>
    `

    const expected = dedent`
      <% @users.each do |user| %>
        <p><%= user.name %></p>
      <% end %>
    `

    const linter = new Linter(Herb, [ERBPreferDoEndBlocksRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("replaces the braces of a block in an output tag", () => {
    const input = dedent`
      <%= form_with(model: @user) { |form| %>
        <%= form.submit %>
      <% } %>
    `

    const expected = dedent`
      <%= form_with(model: @user) do |form| %>
        <%= form.submit %>
      <% end %>
    `

    const linter = new Linter(Herb, [ERBPreferDoEndBlocksRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("replaces the braces of a block without block arguments", () => {
    const input = dedent`
      <% @users.each { %>
        <p>Hello</p>
      <% } %>
    `

    const expected = dedent`
      <% @users.each do %>
        <p>Hello</p>
      <% end %>
    `

    const linter = new Linter(Herb, [ERBPreferDoEndBlocksRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("adds a space between `do` and the block arguments", () => {
    const input = dedent`
      <% @users.each {|user| %>
        <p><%= user.name %></p>
      <% } %>
    `

    const expected = dedent`
      <% @users.each do |user| %>
        <p><%= user.name %></p>
      <% end %>
    `

    const linter = new Linter(Herb, [ERBPreferDoEndBlocksRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("keeps trimming tag closings intact", () => {
    const input = dedent`
      <%- @users.each { |user| -%>
        <p><%= user.name %></p>
      <%- } -%>
    `

    const expected = dedent`
      <%- @users.each do |user| -%>
        <p><%= user.name %></p>
      <%- end -%>
    `

    const linter = new Linter(Herb, [ERBPreferDoEndBlocksRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes nested blocks", () => {
    const input = dedent`
      <% @users.each { |user| %>
        <% user.posts.each { |post| %>
          <p><%= post.title %></p>
        <% } %>
      <% } %>
    `

    const expected = dedent`
      <% @users.each do |user| %>
        <% user.posts.each do |post| %>
          <p><%= post.title %></p>
        <% end %>
      <% end %>
    `

    const linter = new Linter(Herb, [ERBPreferDoEndBlocksRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("replaces only the brace that opens the block", () => {
    const input = dedent`
      <% @users.map { |user| user.posts }.each { |posts| %>
        <p><%= posts.size %></p>
      <% } %>
    `

    const expected = dedent`
      <% @users.map { |user| user.posts }.each do |posts| %>
        <p><%= posts.size %></p>
      <% end %>
    `

    const linter = new Linter(Herb, [ERBPreferDoEndBlocksRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("does not fix a block that `do` would bind to a different call", () => {
    const input = dedent`
      <% puts @users.map { |user| %>
        <p><%= user.name %></p>
      <% } %>
    `

    const linter = new Linter(Herb, [ERBPreferDoEndBlocksRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(1)
  })

  test("fixes a block that `do` would bind to a different call when unsafe fixes are included", () => {
    const input = dedent`
      <% puts @users.map { |user| %>
        <p><%= user.name %></p>
      <% } %>
    `

    const expected = dedent`
      <% puts @users.map do |user| %>
        <p><%= user.name %></p>
      <% end %>
    `

    const linter = new Linter(Herb, [ERBPreferDoEndBlocksRule])
    const result = linter.autofix(input, undefined, undefined, { includeUnsafe: true })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes a block whose result is assigned", () => {
    const input = dedent`
      <% names = @users.map { |user| %>
        <%= user.name %>
      <% } %>
    `

    const expected = dedent`
      <% names = @users.map do |user| %>
        <%= user.name %>
      <% end %>
    `

    const linter = new Linter(Herb, [ERBPreferDoEndBlocksRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })
})
