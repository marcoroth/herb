import { describe, it, expect } from "vitest"
import dedent from "dedent"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter"

import { ERBNoUnusedBlockArgumentRule } from "../../src/rules/erb-no-unused-block-argument"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoUnusedBlockArgumentRule)

describe("erb-no-unused-block-argument", () => {
  it("flags a block argument that is never referenced", () => {
    const html = dedent`
      <% @users.each do |user| %>
        <p>Hello</p>
      <% end %>
    `

    expectError('Block argument `user` is never used. Remove it, or prefix it with an underscore as `_user` to show it is intentionally unused.')

    assertOffenses(html)
  })

  it("reports the offense on the block argument itself", () => {
    const html = dedent`
      <% @users.each do |user| %>
        <p>Hello</p>
      <% end %>
    `

    expectError(
      'Block argument `user` is never used. Remove it, or prefix it with an underscore as `_user` to show it is intentionally unused.',
      [1, 19]
    )

    assertOffenses(html)
  })

  it("does not flag a block argument used in an output tag", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <%= user.name %>
      <% end %>
    `)
  })

  it("does not flag a block argument used in a silent tag", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <% cache user do %>
          <p>cached</p>
        <% end %>
      <% end %>
    `)
  })

  it("does not flag a block argument used in nested control flow", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <% if user.admin? %>
          <p>admin</p>
        <% end %>
      <% end %>
    `)
  })

  it("does not flag a block argument used inside a while loop", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <% while user.pending? %>
          <p>waiting</p>
        <% end %>
      <% end %>
    `)
  })

  it("does not flag a block argument used inside an until loop", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <% until user.ready? %>
          <p>waiting</p>
        <% end %>
      <% end %>
    `)
  })

  it("does not flag a block argument used inside a case statement", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <% case user.role %>
        <% when "admin" %>
          <p>admin</p>
        <% end %>
      <% end %>
    `)
  })

  it("does not flag a block argument used inside a for loop", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <% for role in user.roles %>
          <%= role %>
        <% end %>
      <% end %>
    `)
  })

  it("does not flag a block argument used in a nested iteration block", () => {
    expectNoOffenses(dedent`
      <% @groups.each do |group| %>
        <% group.users.each do |user| %>
          <%= user.name %>
        <% end %>
      <% end %>
    `)
  })

  it("does not flag a block argument used inside string interpolation", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <%= link_to "Profile", user_path(user) %>
      <% end %>
    `)
  })

  it("does not flag a block argument prefixed with an underscore", () => {
    expectNoOffenses(dedent`
      <% @users.each do |_user| %>
        <p>Hello</p>
      <% end %>
    `)
  })

  it("does not flag a bare underscore argument", () => {
    expectNoOffenses(dedent`
      <% @users.each do |_| %>
        <p>Hello</p>
      <% end %>
    `)
  })

  it("does not flag an underscored argument alongside a used one", () => {
    expectNoOffenses(dedent`
      <% @pairs.each do |key, _value| %>
        <%= key %>
      <% end %>
    `)
  })

  it("does not flag an underscored destructured argument", () => {
    expectNoOffenses(dedent`
      <% @pairs.each do |(key, _value)| %>
        <%= key %>
      <% end %>
    `)
  })

  it("does not flag an underscored splat argument", () => {
    expectNoOffenses(dedent`
      <% @rows.each do |*_columns| %>
        <p>Hello</p>
      <% end %>
    `)
  })

  it("does not flag an unused block argument", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user, &callback| %>
        <%= user %>
      <% end %>
    `)
  })

  it("does not flag an unused keyword rest argument", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user, **options| %>
        <%= user %>
      <% end %>
    `)
  })

  it("does not treat HTML text as a reference", () => {
    const html = dedent`
      <% @users.each do |user| %>
        <div class="user">A user</div>
      <% end %>
    `

    expectError('Block argument `user` is never used. Remove it, or prefix it with an underscore as `_user` to show it is intentionally unused.')

    assertOffenses(html)
  })

  it("does not treat a longer identifier as a reference", () => {
    const html = dedent`
      <% @users.each do |user| %>
        <%= users_count %>
      <% end %>
    `

    expectError('Block argument `user` is never used. Remove it, or prefix it with an underscore as `_user` to show it is intentionally unused.')

    assertOffenses(html)
  })

  it("flags each unused argument of a multi-argument block", () => {
    const html = dedent`
      <% @pairs.each do |key, value| %>
        <p>Nothing</p>
      <% end %>
    `

    expectError('Block argument `key` is never used. Remove it, or prefix it with an underscore as `_key` to show it is intentionally unused.')
    expectError('Block argument `value` is never used. Remove it, or prefix it with an underscore as `_value` to show it is intentionally unused.')

    assertOffenses(html)
  })

  it("flags only the unused argument when another is used", () => {
    const html = dedent`
      <% @pairs.each do |key, value| %>
        <%= key %>
      <% end %>
    `

    expectError('Block argument `value` is never used. Remove it, or prefix it with an underscore as `_value` to show it is intentionally unused.')

    assertOffenses(html)
  })

  it("flags an unused destructured argument", () => {
    const html = dedent`
      <% @pairs.each do |(key, value)| %>
        <%= key %>
      <% end %>
    `

    expectError('Block argument `value` is never used. Remove it, or prefix it with an underscore as `_value` to show it is intentionally unused.')

    assertOffenses(html)
  })

  it("flags an unused splat argument", () => {
    const html = dedent`
      <% @rows.each do |*columns| %>
        <p>Nothing</p>
      <% end %>
    `

    expectError('Block argument `columns` is never used. Remove it, or prefix it with an underscore as `_columns` to show it is intentionally unused.')

    assertOffenses(html)
  })

  it("does not flag a block without arguments", () => {
    expectNoOffenses(dedent`
      <% 3.times do %>
        <p>Hello</p>
      <% end %>
    `)
  })

  it("does not flag arguments used in a rescue clause", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <p>Hello</p>
      <% rescue %>
        <%= user %>
      <% end %>
    `)
  })

  it("flags an unused builder block argument", () => {
    const html = dedent`
      <%= form_with model: @user do |form| %>
        <p>Nothing</p>
      <% end %>
    `

    expectError('Block argument `form` is never used. Remove it, or prefix it with an underscore as `_form` to show it is intentionally unused.')

    assertOffenses(html)
  })

  it("does not flag a builder block argument that is used", () => {
    expectNoOffenses(dedent`
      <%= form_with model: @user do |form| %>
        <%= form.text_field :name %>
      <% end %>
    `)
  })

  it("does not flag a block argument used in a nested builder block", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <%= form_with model: user do |form| %>
          <%= form.text_field :name %>
        <% end %>
      <% end %>
    `)
  })

  it("flags the outer argument of nested iteration when only the inner is used", () => {
    const html = dedent`
      <% @groups.each do |group| %>
        <% @users.each do |user| %>
          <%= user.name %>
        <% end %>
      <% end %>
    `

    expectError('Block argument `group` is never used. Remove it, or prefix it with an underscore as `_group` to show it is intentionally unused.')

    assertOffenses(html)
  })

  it("suggests `each` when the `each_with_index` index is unused", () => {
    const html = dedent`
      <% @users.each_with_index do |user, index| %>
        <%= user.name %>
      <% end %>
    `

    expectError('Block argument `index` is never used. Use `each` instead of `each_with_index`, or prefix it with an underscore as `_index` to show it is intentionally unused.')

    assertOffenses(html)
  })

  it("suggests `each` when the index is unused alongside a destructured element", () => {
    const html = dedent`
      <% @pairs.each_with_index do |(name, data), index| %>
        <%= name %>: <%= data %>
      <% end %>
    `

    expectError('Block argument `index` is never used. Use `each` instead of `each_with_index`, or prefix it with an underscore as `_index` to show it is intentionally unused.')

    assertOffenses(html)
  })

  it("suggests `each` for a receiverless `each_with_index`", () => {
    const html = dedent`
      <% each_with_index do |user, index| %>
        <%= user.name %>
      <% end %>
    `

    expectError('Block argument `index` is never used. Use `each` instead of `each_with_index`, or prefix it with an underscore as `_index` to show it is intentionally unused.')

    assertOffenses(html)
  })

  it("does not suggest `each` for an unused element of `each_with_index`", () => {
    const html = dedent`
      <% @users.each_with_index do |user, index| %>
        <%= index %>
      <% end %>
    `

    expectError('Block argument `user` is never used. Remove it, or prefix it with an underscore as `_user` to show it is intentionally unused.')

    assertOffenses(html)
  })

  it("does not suggest `each` when the `each_with_index` block takes a single argument", () => {
    const html = dedent`
      <% @users.each_with_index do |user| %>
        <p>Hello</p>
      <% end %>
    `

    expectError('Block argument `user` is never used. Remove it, or prefix it with an underscore as `_user` to show it is intentionally unused.')

    assertOffenses(html)
  })

  it("does not suggest `each` when the `each_with_index` block splats its arguments", () => {
    const html = dedent`
      <% @users.each_with_index do |user, *rest| %>
        <%= user.name %>
      <% end %>
    `

    expectError('Block argument `rest` is never used. Remove it, or prefix it with an underscore as `_rest` to show it is intentionally unused.')

    assertOffenses(html)
  })

  it("does not suggest `each` for an unused argument of another iterator", () => {
    const html = dedent`
      <% @users.each_with_object([]) do |user, index| %>
        <%= user.name %>
      <% end %>
    `

    expectError('Block argument `index` is never used. Remove it, or prefix it with an underscore as `_index` to show it is intentionally unused.')

    assertOffenses(html)
  })

  it("does not flag a used `each_with_index` index", () => {
    expectNoOffenses(dedent`
      <% @users.each_with_index do |user, index| %>
        <%= index %>: <%= user.name %>
      <% end %>
    `)
  })

  it("does not flag an underscored `each_with_index` index", () => {
    expectNoOffenses(dedent`
      <% @users.each_with_index do |user, _index| %>
        <%= user.name %>
      <% end %>
    `)
  })

  it("tags the offense as unnecessary so editors grey the argument out", async () => {
    await Herb.load()

    const linter = new Linter(Herb, [ERBNoUnusedBlockArgumentRule])
    const result = linter.lint(dedent`
      <% @users.each do |user| %>
        <p>Hello</p>
      <% end %>
    `)

    expect(result.offenses).toHaveLength(1)
    expect(result.offenses[0].tags).toEqual(["unnecessary"])
    expect(result.offenses[0].severity).toBe("error")
  })

  it("reports as info in the editor and an error in CI", () => {
    const source = dedent`
      <% @users.each do |user| %>
        <p>Hello</p>
      <% end %>
    `

    const cli = new Linter(Herb, [ERBNoUnusedBlockArgumentRule])
    expect(cli.lint(source).offenses[0].severity).toBe("error")

    const editor = new Linter(Herb, [ERBNoUnusedBlockArgumentRule])
    editor.mode = "editor"
    expect(editor.lint(source).offenses[0].severity).toBe("info")
  })
})
