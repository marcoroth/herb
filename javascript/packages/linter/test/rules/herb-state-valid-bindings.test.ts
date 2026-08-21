import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbStateValidBindingsRule } from "../../src/rules/herb-state-valid-bindings.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HerbStateValidBindingsRule)

describe("HerbStateValidBindingsRule", () => {
  test("allows bindings whose kinds match", () => {
    expectNoOffenses(dedent`
      <%# herb:state (draft: "", agreed: false, attempts: 0) %>
      <input value="<%= draft %>">
      <input type="checkbox" checked="<%= agreed %>">
      <textarea><%= draft %></textarea>
      <input type="number" value="<%= attempts %>">
    `)
  })

  test("allows a value binding a server expression", () => {
    expectNoOffenses(dedent`
      <%# herb:state (draft: "") %>
      <input value="<%= message.body %>">
      <input value="<%= draft.upcase %>">
    `)
  })

  test("flags checked binding a non-boolean state", () => {
    expectError("`checked` binds the String state `draft`, and `checked` holds a boolean. Declare it as one, like `(draft: false)`, or bind a different state.")

    assertOffenses(dedent`
      <%# herb:state (draft: "") %>
      <input type="checkbox" checked="<%= draft %>">
    `)
  })

  test("flags selected binding a non-boolean state", () => {
    expectError("`selected` binds the Integer state `attempts`, and `selected` holds a boolean. Declare it as one, like `(attempts: false)`, or bind a different state.")

    assertOffenses(dedent`
      <%# herb:state (attempts: 0) %>
      <select><option selected="<%= attempts %>">One</option></select>
    `)
  })

  test("flags value binding a boolean state", () => {
    expectError("`value` on `<input>` binds the Boolean state `agreed`, and a `value` holds text. Declare it as a String, like `(agreed: \"\")`.")

    assertOffenses(dedent`
      <%# herb:state (agreed: false) %>
      <input value="<%= agreed %>">
    `)
  })

  test("flags a textarea binding a boolean state", () => {
    expectError("`<textarea>` binds the Boolean state `agreed`, and a textarea holds text. Declare it as a String, like `(agreed: \"\")`.")

    assertOffenses(dedent`
      <%# herb:state (agreed: false) %>
      <textarea><%= agreed %></textarea>
    `)
  })

  test("checks nothing in a template with no declarations", () => {
    expectNoOffenses(dedent`
      <input value="<%= draft %>">
      <textarea><%= agreed %></textarea>
    `)
  })

  test("resolves an item state per row", () => {
    expectNoOffenses(dedent`
      <% @rows.each do |row| %>
        <%# herb:state (starred: false) %>
        <input type="checkbox" checked="<%= starred %>">
      <% end %>
    `)
  })

  test("flags an item-scoped kind mismatch", () => {
    expectError("`checked` binds the Integer state `count`, and `checked` holds a boolean. Declare it as one, like `(count: false)`, or bind a different state.")

    assertOffenses(dedent`
      <% @rows.each do |row| %>
        <%# herb:state (count: 0) %>
        <input type="checkbox" checked="<%= count %>">
      <% end %>
    `)
  })
})
