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

    expectError("Control flow statements like `if` should not be used with output tags. Use `<% if ... %>` instead.")
    assertOffenses(html)
  })

  it("should not allow unless statements with output tags", () => {
    const html = dedent`
      <%= unless false %>
        <div>Text1</div>
      <% end %>
    `

    expectError("Control flow statements like `unless` should not be used with output tags. Use `<% unless ... %>` instead.")
    assertOffenses(html)
  })

  it("should not allow end statements with output tags", () => {
    const html = dedent`
      <% if true %>
        <div>Text1</div>
      <%= end %>
    `

    expectError("Control flow statements like `end` should not be used with output tags. Use `<% end ... %>` instead.")
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

    expectError("Control flow statements like `if` should not be used with output tags. Use `<% if ... %>` instead.")
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

    expectError("Control flow statements like `if` should not be used with output tags. Use `<% if ... %>` instead.")
    expectError("Control flow statements like `else` should not be used with output tags. Use `<% else ... %>` instead.")
    expectError("Control flow statements like `end` should not be used with output tags. Use `<% end ... %>` instead.")
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

    expectError("Control flow statements like `if` should not be used with output tags. Use `<% if ... %>` instead.")
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
})
