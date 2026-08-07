import { describe, it, expect } from "vitest"
import dedent from "dedent"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter"

import { ERBNoUnusedBlockArgumentRule } from "../../src/rules/erb-no-unused-block-argument"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoUnusedBlockArgumentRule)

describe("erb-no-unused-block-argument", () => {
  it("flags a block argument that is never referenced", () => {
    expectError('Block argument `user` is never used. Remove it and write `<% @users.each do %>`, or prefix it with an underscore as `_user` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% @users.each do |user| %>
        <p>Hello</p>
      <% end %>
    `)
  })

  it("reports the offense on the block argument itself", () => {
    expectError(
      'Block argument `user` is never used. Remove it and write `<% @users.each do %>`, or prefix it with an underscore as `_user` to show it is intentionally unused.',
      [1, 19]
    )

    assertOffenses(dedent`
      <% @users.each do |user| %>
        <p>Hello</p>
      <% end %>
    `)
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
    expectError('Block argument `user` is never used. Remove it and write `<% @users.each do %>`, or prefix it with an underscore as `_user` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% @users.each do |user| %>
        <div class="user">A user</div>
      <% end %>
    `)
  })

  it("does not treat a longer identifier as a reference", () => {
    expectError('Block argument `user` is never used. Remove it and write `<% @users.each do %>`, or prefix it with an underscore as `_user` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% @users.each do |user| %>
        <%= users_count %>
      <% end %>
    `)
  })

  it("flags each unused argument of a multi-argument block", () => {
    expectError('Block argument `key` is never used. Remove it and write `<% @pairs.each do %>`, or prefix it with an underscore as `_key` to show it is intentionally unused.')
    expectError('Block argument `value` is never used. Remove it and write `<% @pairs.each do %>`, or prefix it with an underscore as `_value` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% @pairs.each do |key, value| %>
        <p>Nothing</p>
      <% end %>
    `)
  })

  it("does not suggest removing an argument that another one is used alongside", () => {
    expectError('Block argument `value` is never used. Prefix it with an underscore as `_value` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% @pairs.each do |key, value| %>
        <%= key %>
      <% end %>
    `)
  })

  it("does not suggest removing an unused destructured argument", () => {
    expectError('Block argument `value` is never used. Prefix it with an underscore as `_value` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% @pairs.each do |(key, value)| %>
        <%= key %>
      <% end %>
    `)
  })

  it("suggests removing every argument when all of them are destructured and unused", () => {
    expectError('Block argument `key` is never used. Remove it and write `<% @pairs.each do %>`, or prefix it with an underscore as `_key` to show it is intentionally unused.')
    expectError('Block argument `value` is never used. Remove it and write `<% @pairs.each do %>`, or prefix it with an underscore as `_value` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% @pairs.each do |(key, value)| %>
        <p>Nothing</p>
      <% end %>
    `)
  })

  it("flags an unused splat argument", () => {
    expectError('Block argument `columns` is never used. Remove it and write `<% @rows.each do %>`, or prefix it with an underscore as `_columns` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% @rows.each do |*columns| %>
        <p>Nothing</p>
      <% end %>
    `)
  })

  it("does not rewrite the tag when a block argument stays behind", () => {
    expectError('Block argument `user` is never used. Remove it, or prefix it with an underscore as `_user` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% @users.each do |user, &callback| %>
        <p>Nothing</p>
      <% end %>
    `)
  })

  it("does not rewrite a tag that spans multiple lines", () => {
    expectError('Block argument `panel` is never used. Remove it, or prefix it with an underscore as `_panel` to show it is intentionally unused.')

    assertOffenses(dedent`
      <%= panel title: "Hello",
            subtitle: "World" do |panel| %>
        <p>Nothing</p>
      <% end %>
    `)
  })

  it("does not rewrite a tag that would make the message unwieldy", () => {
    expectError('Block argument `panel` is never used. Remove it, or prefix it with an underscore as `_panel` to show it is intentionally unused.')

    assertOffenses(dedent`
      <%= panel title: "Hello", subtitle: "World", classes: "border rounded shadow" do |panel| %>
        <p>Nothing</p>
      <% end %>
    `)
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

  it("names what the helper yields for an unused builder block argument", () => {
    expectError('Block argument `form` is never used. It is the `ActionView::Helpers::FormBuilder` yielded by `form_with`, so prefix it with an underscore as `_form` to show it is intentionally unused.')

    assertOffenses(dedent`
      <%= form_with model: @user do |form| %>
        <p>Nothing</p>
      <% end %>
    `, { framework: "actionview" })
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
    expectError('Block argument `group` is never used. Remove it and write `<% @groups.each do %>`, or prefix it with an underscore as `_group` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% @groups.each do |group| %>
        <% @users.each do |user| %>
          <%= user.name %>
        <% end %>
      <% end %>
    `)
  })

  it("suggests `each do` when the only `each` argument is unused", () => {
    expectError('Block argument `page` is never used. Remove it and write `<% pages.each do %>`, or prefix it with an underscore as `_page` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% pages.each do |page| %>
        <div class="page"></div>
      <% end %>
    `)
  })

  it("keeps the trim markers of the ERB tag in the suggestion", () => {
    expectError('Block argument `page` is never used. Remove it and write `<%- pages.each do -%>`, or prefix it with an underscore as `_page` to show it is intentionally unused.')

    assertOffenses(dedent`
      <%- pages.each do |page| -%>
        <div class="page"></div>
      <%- end -%>
    `)
  })

  it("suggests `each do` for a chained receiver", () => {
    expectError('Block argument `page` is never used. Remove it and write `<% @user.pages.each do %>`, or prefix it with an underscore as `_page` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% @user.pages.each do |page| %>
        <div class="page"></div>
      <% end %>
    `)
  })

  it("suggests `each do` for a constant receiver", () => {
    expectError('Block argument `page` is never used. Remove it and write `<% Page.all.each do %>`, or prefix it with an underscore as `_page` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% Page.all.each do |page| %>
        <div class="page"></div>
      <% end %>
    `)
  })

  it("keeps a receiverless call in the suggestion", () => {
    expectError('Block argument `page` is never used. Remove it and write `<% each do %>`, or prefix it with an underscore as `_page` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% each do |page| %>
        <div class="page"></div>
      <% end %>
    `)
  })

  it("keeps the arguments of the receiver in the suggestion", () => {
    expectError('Block argument `page` is never used. Remove it and write `<% pages.where(published: true).each do %>`, or prefix it with an underscore as `_page` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% pages.where(published: true).each do |page| %>
        <div class="page"></div>
      <% end %>
    `)
  })

  it("keeps safe navigation in the suggestion", () => {
    expectError('Block argument `page` is never used. Remove it and write `<% pages&.each do %>`, or prefix it with an underscore as `_page` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% pages&.each do |page| %>
        <div class="page"></div>
      <% end %>
    `)
  })

  it("suggests the tag for another iterator", () => {
    expectError('Block argument `page` is never used. Remove it and write `<% pages.map do %>`, or prefix it with an underscore as `_page` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% pages.map do |page| %>
        <div class="page"></div>
      <% end %>
    `)
  })

  it("suggests the tag for a block that is not an iteration", () => {
    expectError('Block argument `index` is never used. Remove it and write `<% 3.times do %>`, or prefix it with an underscore as `_index` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% 3.times do |index| %>
        <div class="page"></div>
      <% end %>
    `)
  })

  it("does not use the helper registry without an Action View project", () => {
    expectError('Block argument `form` is never used. Remove it and write `<%= form_with model: @user do %>`, or prefix it with an underscore as `_form` to show it is intentionally unused.')

    assertOffenses(dedent`
      <%= form_with model: @user do |form| %>
        <p>Nothing</p>
      <% end %>
    `)
  })

  it("does not use the helper registry for another framework", () => {
    expectError('Block argument `entry` is never used. Remove it and write `<% cache @post do %>`, or prefix it with an underscore as `_entry` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% cache @post do |entry| %>
        <p>Nothing</p>
      <% end %>
    `, { framework: "hanami" })
  })

  it("names what the helper yields for a nested form builder", () => {
    expectError('Block argument `fields` is never used. It is the `ActionView::Helpers::FormBuilder` yielded by `fields_for`, so prefix it with an underscore as `_fields` to show it is intentionally unused.')

    assertOffenses(dedent`
      <%= fields_for :address do |fields| %>
        <p>Nothing</p>
      <% end %>
    `, { framework: "actionview" })
  })

  it("names what the `tag` builder yields", () => {
    expectError('Block argument `builder` is never used. It is the `ActionView::Helpers::TagHelper::TagBuilder` yielded by `tag`, so prefix it with an underscore as `_builder` to show it is intentionally unused.')

    assertOffenses(dedent`
      <%= tag.div do |builder| %>
        <p>Nothing</p>
      <% end %>
    `, { framework: "actionview" })
  })

  it("reports an argument of a helper that yields nothing as always `nil`", () => {
    expectError('Block argument `entry` is never used. `cache` yields nothing to its block, so it is always `nil`. Remove it and write `<% cache @post do %>`, or prefix it with an underscore as `_entry` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% cache @post do |entry| %>
        <p>Nothing</p>
      <% end %>
    `, { framework: "actionview" })
  })

  it("reports a `content_tag` argument as always `nil`", () => {
    expectError('Block argument `builder` is never used. `content_tag` yields nothing to its block, so it is always `nil`. Remove it and write `<%= content_tag :div do %>`, or prefix it with an underscore as `_builder` to show it is intentionally unused.')

    assertOffenses(dedent`
      <%= content_tag :div do |builder| %>
        <p>Nothing</p>
      <% end %>
    `, { framework: "actionview" })
  })

  it("reports an argument past what the helper yields as always `nil`", () => {
    expectError('Block argument `extra` is never used. `form_with` yields 1 argument, so it is always `nil`. Remove it, or prefix it with an underscore as `_extra` to show it is intentionally unused.')

    assertOffenses(dedent`
      <%= form_with model: @user do |form, extra| %>
        <%= form.text_field :name %>
      <% end %>
    `, { framework: "actionview" })
  })

  it("does not claim anything about a block the rendered template drives", () => {
    expectError('Block argument `box` is never used. Remove it and write `<%= render layout: "box" do %>`, or prefix it with an underscore as `_box` to show it is intentionally unused.')

    assertOffenses(dedent`
      <%= render layout: "box" do |box| %>
        <p>Nothing</p>
      <% end %>
    `, { framework: "actionview" })
  })

  it("does not use the helper registry for a call with a receiver", () => {
    expectError('Block argument `entry` is never used. Remove it and write `<% @view.cache do %>`, or prefix it with an underscore as `_entry` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% @view.cache do |entry| %>
        <p>Nothing</p>
      <% end %>
    `)
  })

  it("does not line a destructured argument up with what the helper yields", () => {
    expectError('Block argument `key` is never used. Remove it and write `<%= content_tag :div do %>`, or prefix it with an underscore as `_key` to show it is intentionally unused.')
    expectError('Block argument `value` is never used. Remove it and write `<%= content_tag :div do %>`, or prefix it with an underscore as `_value` to show it is intentionally unused.')

    assertOffenses(dedent`
      <%= content_tag :div do |(key, value)| %>
        <p>Nothing</p>
      <% end %>
    `)
  })

  it("suggests `each` when the `each_with_index` index is unused", () => {
    expectError('Block argument `index` is never used. Use `each` instead of `each_with_index`, or prefix it with an underscore as `_index` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% @users.each_with_index do |user, index| %>
        <%= user.name %>
      <% end %>
    `)
  })

  it("suggests `each` when the index is unused alongside a destructured element", () => {
    expectError('Block argument `index` is never used. Use `each` instead of `each_with_index`, or prefix it with an underscore as `_index` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% @pairs.each_with_index do |(name, data), index| %>
        <%= name %>: <%= data %>
      <% end %>
    `)
  })

  it("suggests `each` for a receiverless `each_with_index`", () => {
    expectError('Block argument `index` is never used. Use `each` instead of `each_with_index`, or prefix it with an underscore as `_index` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% each_with_index do |user, index| %>
        <%= user.name %>
      <% end %>
    `)
  })

  it("does not suggest `each` for an unused element of `each_with_index`", () => {
    expectError('Block argument `user` is never used. Prefix it with an underscore as `_user` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% @users.each_with_index do |user, index| %>
        <%= index %>
      <% end %>
    `)
  })

  it("suggests `each` when the `each_with_index` block takes a single unused argument", () => {
    expectError('Block argument `user` is never used. Remove it and write `<% @users.each do %>`, or prefix it with an underscore as `_user` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% @users.each_with_index do |user| %>
        <p>Hello</p>
      <% end %>
    `)
  })

  it("suggests `each` when neither `each_with_index` argument is used", () => {
    expectError('Block argument `user` is never used. Remove it and write `<% @users.each do %>`, or prefix it with an underscore as `_user` to show it is intentionally unused.')
    expectError('Block argument `index` is never used. Remove it and write `<% @users.each do %>`, or prefix it with an underscore as `_index` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% @users.each_with_index do |user, index| %>
        <p>Hello</p>
      <% end %>
    `)
  })

  it("does not suggest `each` when the `each_with_index` block splats its arguments", () => {
    expectError('Block argument `rest` is never used. Prefix it with an underscore as `_rest` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% @users.each_with_index do |user, *rest| %>
        <%= user.name %>
      <% end %>
    `)
  })

  it("does not suggest `each` for an unused argument of another iterator", () => {
    expectError('Block argument `index` is never used. Prefix it with an underscore as `_index` to show it is intentionally unused.')

    assertOffenses(dedent`
      <% @users.each_with_object([]) do |user, index| %>
        <%= user.name %>
      <% end %>
    `)
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
