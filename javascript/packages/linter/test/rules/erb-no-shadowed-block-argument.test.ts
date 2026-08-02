import { describe, it } from "vitest"
import dedent from "dedent"

import { ERBNoShadowedBlockArgumentRule } from "../../src/rules/erb-no-shadowed-block-argument"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoShadowedBlockArgumentRule)

const shadows = (name: string) =>
  `Block argument \`${name}\` shadows an outer \`${name}\`. Rename it so both remain reachable.`

describe("erb-no-shadowed-block-argument", () => {
  it("flags a block argument shadowing an outer block argument", () => {
    const html = dedent`
      <% @groups.each do |item| %>
        <% @items.each do |item| %>
          <%= item %>
        <% end %>
      <% end %>
    `

    expectError(shadows("item"))

    assertOffenses(html)
  })

  it("reports the offense on the inner argument", () => {
    const html = dedent`
      <% @groups.each do |item| %>
        <% @items.each do |item| %>
          <%= item %>
        <% end %>
      <% end %>
    `

    expectError(shadows("item"), [2, 21])

    assertOffenses(html)
  })

  it("flags a for loop shadowing an outer block argument", () => {
    const html = dedent`
      <% @groups.each do |item| %>
        <% for item in @items %>
          <%= item %>
        <% end %>
      <% end %>
    `

    expectError(shadows("item"))

    assertOffenses(html)
  })

  it("flags a block argument shadowing an outer for loop", () => {
    const html = dedent`
      <% for item in @groups %>
        <% @items.each do |item| %>
          <%= item %>
        <% end %>
      <% end %>
    `

    expectError(shadows("item"))

    assertOffenses(html)
  })

  it("flags a for loop shadowing an outer for loop", () => {
    const html = dedent`
      <% for item in @groups %>
        <% for item in @items %>
          <%= item %>
        <% end %>
      <% end %>
    `

    expectError(shadows("item"))

    assertOffenses(html)
  })

  it("flags a block argument shadowing a form builder argument", () => {
    const html = dedent`
      <%= form_with model: @user do |form| %>
        <% @forms.each do |form| %>
          <%= form %>
        <% end %>
      <% end %>
    `

    expectError(shadows("form"))

    assertOffenses(html)
  })

  it("flags a form builder argument shadowing an outer block argument", () => {
    const html = dedent`
      <% @users.each do |form| %>
        <%= form_with model: @user do |form| %>
          <%= form.text_field :name %>
        <% end %>
      <% end %>
    `

    expectError(shadows("form"))

    assertOffenses(html)
  })

  it("flags a destructured argument shadowing an outer binding", () => {
    const html = dedent`
      <% @rows.each do |key| %>
        <% @pairs.each do |(key, value)| %>
          <%= key %><%= value %>
        <% end %>
      <% end %>
    `

    expectError(shadows("key"))

    assertOffenses(html)
  })

  it("flags shadowing across two levels of nesting", () => {
    const html = dedent`
      <% @a.each do |item| %>
        <% @b.each do |other| %>
          <% @c.each do |item| %>
            <%= item %>
          <% end %>
        <% end %>
      <% end %>
    `

    expectError(shadows("item"))

    assertOffenses(html)
  })

  it("flags a multi-target for loop shadowing an outer binding", () => {
    const html = dedent`
      <% @rows.each do |value| %>
        <% for key, value in @pairs %>
          <%= key %>
        <% end %>
      <% end %>
    `

    expectError(shadows("value"))

    assertOffenses(html)
  })

  it("does not flag distinct names", () => {
    expectNoOffenses(dedent`
      <% @groups.each do |group| %>
        <% group.items.each do |item| %>
          <%= item %>
        <% end %>
      <% end %>
    `)
  })

  it("does not flag sibling blocks reusing a name", () => {
    expectNoOffenses(dedent`
      <% @groups.each do |item| %>
        <%= item %>
      <% end %>

      <% @items.each do |item| %>
        <%= item %>
      <% end %>
    `)
  })

  it("does not flag a name reused after the outer block closes", () => {
    expectNoOffenses(dedent`
      <% @groups.each do |group| %>
        <%= group %>
      <% end %>

      <% for group in @others %>
        <%= group %>
      <% end %>
    `)
  })

  it("does not flag a single block", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <%= user %>
      <% end %>
    `)
  })

  it("does not flag a single for loop", () => {
    expectNoOffenses(dedent`
      <% for user in @users %>
        <%= user %>
      <% end %>
    `)
  })

  it("does not flag nested blocks without arguments", () => {
    expectNoOffenses(dedent`
      <% 3.times do %>
        <% 2.times do %>
          <p>Hello</p>
        <% end %>
      <% end %>
    `)
  })
})
