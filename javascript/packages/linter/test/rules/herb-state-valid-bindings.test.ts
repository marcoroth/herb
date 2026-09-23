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

  test("flags a value binding on a select", () => {
    expectError("`value` on `<select>` binds the state `order`, and HTML has no `value` attribute on a `<select>`. The browser ignores it, so a server-rendered page shows the first option and not the current one. Write the choice with an action, like `data-herb-set=\"order=$value\"`, and mark the rendered option with `selected` so a value other than the first option renders selected.")

    assertOffenses(dedent`
      <%# herb:state (order: "oldest") %>
      <select value="<%= order %>">
        <option value="oldest">Oldest first</option>
        <option value="newest">Newest first</option>
      </select>
    `)
  })

  test("flags a value binding on a select ahead of the kind mismatch", () => {
    expectError("`value` on `<select>` binds the state `agreed`, and HTML has no `value` attribute on a `<select>`. The browser ignores it, so a server-rendered page shows the first option and not the current one. Write the choice with an action, like `data-herb-set=\"agreed=$value\"`, and mark the rendered option with `selected` so a value other than the first option renders selected.")

    assertOffenses(dedent`
      <%# herb:state (agreed: false) %>
      <select value="<%= agreed %>"><option value="yes">Yes</option></select>
    `)
  })

  test("allows a select written with an action and selected options", () => {
    expectNoOffenses(dedent`
      <%# herb:state (order: "oldest") %>
      <select data-herb-set="order=$value">
        <option value="oldest" selected="<%= order == "oldest" %>">Oldest first</option>
        <option value="newest" selected="<%= order == "newest" %>">Newest first</option>
      </select>
    `)
  })

  test("allows a value binding on a select's options", () => {
    expectNoOffenses(dedent`
      <%# herb:state (order: "oldest") %>
      <select data-herb-set="order=$value">
        <option value="<%= order %>">Current</option>
      </select>
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
  test("flags a control bound to a derived state", () => {
    expectError("`checked` binds the derived state `busy`, and a binding writes back what the user changes. A derived state cannot be written, so bind one of its sources, or show the value outside a form control.")

    assertOffenses(dedent`
      <%# herb:state (pending: false, failed: false, busy: pending || failed) %>
      <input type="checkbox" checked="<%= busy %>">
    `)
  })

  test("flags a textarea bound to a derived state", () => {
    expectError("`<textarea>` binds the derived state `copy`, and a binding writes back what the user changes. A derived state cannot be written, so bind one of its sources, or show the value outside a form control.")

    assertOffenses(dedent`
      <%# herb:state (draft: "", copy: draft) %>
      <textarea><%= copy %></textarea>
    `)
  })
  test("flags a control bound to a counted state", () => {
    expectError("`value` binds the counted state `total`, and a binding writes back what the user changes. A counted state follows its items, so show the value outside a form control.")

    assertOffenses(dedent`
      <%# herb:state (total: 0) %>
      <ul><% @items.each do |item| %><% total += 1 %><li><%= item %></li><% end %></ul>
      <input type="number" value="<%= total %>">
    `)
  })
  test("checks a binding built by a tag helper", () => {
    expectError("`value` on `<input>` binds the Boolean state `pending`, and a `value` holds text. Declare it as a String, like `(pending: \"\")`.")

    assertOffenses(dedent`
      <%# herb:state (pending: false, draft: "") %>
      <%= tag.input value: draft %>
      <%= tag.input value: pending %>
    `)
  })
})
