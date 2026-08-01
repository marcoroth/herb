import { describe, it } from "vitest"
import dedent from "dedent"

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

  it("does not flag builder blocks", () => {
    expectNoOffenses(dedent`
      <%= form_with model: @user do |form| %>
        <p>Nothing</p>
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
})
