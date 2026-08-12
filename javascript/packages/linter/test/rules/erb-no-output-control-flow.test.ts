import { describe, it } from "vitest"
import dedent from "dedent";

import { ERBNoOutputControlFlowRule } from "../../src/rules/erb-no-output-control-flow";
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoOutputControlFlowRule)

describe("erb-no-output-control-flow", () => {
  it("should allow if statements without output tags", () => {
    const html = dedent`
      <% if true %>
        <div>Text1</div>
      <% elsif false %>
        <div>Text2</div>
      <% else %>
        <div>Text3</div>
      <% end %>
    `

    expectNoOffenses(html)
  })

  it("should not allow if statments with output tags", () => {
    const html = dedent`
      <%= if true %>
        <div>Text1</div>
      <% end %>
    `

    expectError("Control flow statements like `if` should not be used with output tags. Use `<% if true %>` instead.")
    assertOffenses(html)
  })

  it("should not allow unless statements with output tags", () => {
    const html = dedent`
      <%= unless false %>
        <div>Text1</div>
      <% end %>
    `

    expectError("Control flow statements like `unless` should not be used with output tags. Use `<% unless false %>` instead.")
    assertOffenses(html)
  })

  it("should not allow end statements with output tags", () => {
    const html = dedent`
      <% if true %>
        <div>Text1</div>
      <%= end %>
    `

    expectError("Control flow statements like `end` should not be used with output tags. Use `<% end %>` instead.")
    assertOffenses(html)
  })

  it("should not allow nested control flow blocks with output tags", () => {
    const html = dedent`
      <% if true %>
        <div>Text1</div>
        <%= if true %>
          <div>Nested Text</div>
        <% end %>
      <% end %>
    `

    expectError("Control flow statements like `if` should not be used with output tags. Use `<% if true %>` instead.")
    assertOffenses(html)
  })

  it('should show multiple errors for multiple output tags', () => {
    const html = dedent`
      <% if true %>
        <div>Text1</div>
      <%= elsif false %>
        <div>Text2</div>
      <%= else %>
        <div>Text3</div>
      <%= end %>
    `

    expectError("Control flow statements like `elsif` should not be used with output tags. Use `<% elsif false %>` instead.")
    expectError("Control flow statements like `else` should not be used with output tags. Use `<% else %>` instead.")
    expectError("Control flow statements like `end` should not be used with output tags. Use `<% end %>` instead.")
    assertOffenses(html)
  })

  it("should show an error for outputting control flow blocks with nested control flow blocks", () => {
   const html = dedent`
      <% unless something? %>
        <%= if true %>
          thing
        <% end %>
      <% end %>
    `

    expectError("Control flow statements like `if` should not be used with output tags. Use `<% if true %>` instead.")
    assertOffenses(html)
  })

  it("names `elsif` instead of `if` and suggests the actual condition", () => {
    const html = dedent`
      <% if condition? %>
        ...
      <%= elsif another_condition? %>
        ...
      <% end %>
    `

    expectError("Control flow statements like `elsif` should not be used with output tags. Use `<% elsif another_condition? %>` instead.")

    assertOffenses(html)
  })

  it("preserves trim tags in the suggested control flow replacement", () => {
    const html = dedent`
      <%= if condition? -%>
        ...
      <% end %>
    `

    expectError("Control flow statements like `if` should not be used with output tags. Use `<% if condition? -%>` instead.")

    assertOffenses(html)
  })

  it("collapses a multi-line condition onto one line in the suggestion", () => {
    const html = dedent`
      <%= if first_condition? &&
            second_condition? %>
        ...
      <% end %>
    `

    expectError("Control flow statements like `if` should not be used with output tags. Use `<% if first_condition? && second_condition? %>` instead.")

    assertOffenses(html)
  })

  it("should not report for link to with an if condition", () => {
   const html = dedent`
      <%= link_to(some_url, class: ("some-class" if some_condition)) do %>
        Click
      <% end %>
    `

    expectNoOffenses(html)
  })

  it("should not report on form_builder.fieldset with block", () => {
   const html = dedent`
     <%= form_builder.fieldset(
       "foo",
       :foo,
       required: true,
       hint:
         if some_condition?
           "foo"
         else
           "bar"
         end
     ) do %>
         <%# ... %>
     <% end %>
    `

    expectNoOffenses(html)
  })

  it("should not report on yield with if in the same ERB tag", () => {
   const html = dedent`
      <%= yield(:header) if content_for?(:header) %>
    `

    expectNoOffenses(html)
  })

  it("should allow iteration blocks without output tags", () => {
    expectNoOffenses(dedent`
      <% [1, 2, 3, 4, 5].each do |i| %>
        <%= i * i %>
      <% end %>
    `)
  })

  it("should not allow each blocks with output tags", () => {
    const html = dedent`
      <%= [1, 2, 3, 4, 5].each do |i| %>
        <%= i * i %>
      <% end %>
    `

    expectError('Iteration blocks like `each` should not be used with output tags, they return the collection instead of the rendered output. Use `<% [1, 2, 3, 4, 5].each do |i| %>` instead.')

    assertOffenses(html)
  })

  it("names the iteration method in the message", () => {
    const html = dedent`
      <%= 3.times do |i| %>
        <%= i %>
      <% end %>
    `

    expectError('Iteration blocks like `times` should not be used with output tags, they return the collection instead of the rendered output. Use `<% 3.times do |i| %>` instead.')

    assertOffenses(html)
  })

  it("should flag a nested each block with an output tag", () => {
    const html = dedent`
      <% groups.each do |group| %>
        <%= group.items.each do |item| %>
          <%= item %>
        <% end %>
      <% end %>
    `

    expectError('Iteration blocks like `each` should not be used with output tags, they return the collection instead of the rendered output. Use `<% group.items.each do |item| %>` instead.')

    assertOffenses(html)
  })

  it("should not allow brace iteration blocks with output tags", () => {
    const html = dedent`
      <%= items.each { |item| %>
        <%= item %>
      <% } %>
    `

    expectError('Iteration blocks like `each` should not be used with output tags, they return the collection instead of the rendered output. Use `<% items.each { |item| %>` instead.')

    assertOffenses(html)
  })

  it("should allow an output tag inside an iteration block body", () => {
    expectNoOffenses(dedent`
      <% items.each do |item| %>
        <%= item.name %>
      <% end %>
    `)
  })

  it("should flag each iteration block that uses an output tag", () => {
    const html = dedent`
      <%= first.each do |item| %>
        <%= item %>
      <% end %>

      <%= second.map do |item| %>
        <%= item %>
      <% end %>
    `

    expectError('Iteration blocks like `each` should not be used with output tags, they return the collection instead of the rendered output. Use `<% first.each do |item| %>` instead.')
    expectError('Iteration blocks like `map` should not be used with output tags, they return the collection instead of the rendered output. Use `<% second.map do |item| %>` instead.')

    assertOffenses(html)
  })

  it("preserves trim tags in the suggested replacement", () => {
    const html = dedent`
      <%= items.each do |item| -%>
        <%= item %>
      <% end %>
    `

    expectError('Iteration blocks like `each` should not be used with output tags, they return the collection instead of the rendered output. Use `<% items.each do |item| -%>` instead.')

    assertOffenses(html)
  })

  it("collapses a multi-line iteration block onto one line in the suggestion", () => {
    const html = dedent`
      <%= [
        1,
        2
      ].each do |i| %>
        <%= i %>
      <% end %>
    `

    expectError('Iteration blocks like `each` should not be used with output tags, they return the collection instead of the rendered output. Use `<% [ 1, 2 ].each do |i| %>` instead.')

    assertOffenses(html)
  })

  it("suggests the replacement for a call with arguments", () => {
    const html = dedent`
      <%= items.each_slice(3) do |group| %>
        <%= group %>
      <% end %>
    `

    expectError('Iteration blocks like `each_slice` should not be used with output tags, they return the collection instead of the rendered output. Use `<% items.each_slice(3) do |group| %>` instead.')

    assertOffenses(html)
  })

  it("should allow non-iteration blocks with output tags", () => {
    expectNoOffenses(dedent`
      <%= content_tag :div do %>
        <span>content</span>
      <% end %>
    `)

    expectNoOffenses(dedent`
      <%= @user.tap do |user| %>
        <%= user %>
      <% end %>
    `)
  })
})
