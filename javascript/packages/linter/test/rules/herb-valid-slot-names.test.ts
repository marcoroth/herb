import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbValidSlotNamesRule } from "../../src/rules/herb-valid-slot-names.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HerbValidSlotNamesRule)

describe("HerbValidSlotNamesRule", () => {
  test("flags a named element claiming the slot another one names", () => {
    expectError('`data-herb-name="inner"` claims the slot already named `outer`. Keep one name or wrap what each should address, since both elements hold the same slot.')

    assertOffenses(dedent`
      <div data-herb-name="outer"><span data-herb-name="inner"><%= body %></span></div>
    `)
  })

  test("allows a named element beside more dynamic content", () => {
    expectNoOffenses(dedent`
      <div data-herb-name="outer"><span data-herb-name="inner"><%= body %></span><%= caption %></div>
    `)
  })

  test("allows a named content slot", () => {
    expectNoOffenses(dedent`
      <p data-herb-name="body"><%= message.body %></p>
    `)
  })

  test("allows a named collection", () => {
    expectNoOffenses(dedent`
      <ul data-herb-name="messages">
        <% @messages.each do |message| %>
          <li><%= message.body %></li>
        <% end %>
      </ul>
    `)
  })

  test("allows the same name in an item and its region", () => {
    expectNoOffenses(dedent`
      <p data-herb-name="body"><%= @summary %></p>
      <% @messages.each do |message| %>
        <span data-herb-name="body"><%= message.body %></span>
      <% end %>
    `)
  })

  test("allows a name on an element whose only dynamic part is an attribute", () => {
    expectNoOffenses(dedent`
      <li data-herb-name="row" id="<%= dom_id(message) %>">static text</li>
    `)
  })

  test("flags a dynamic name", () => {
    expectError("`data-herb-name` on `<p>` must be a static, non-empty value. Write the name out, since a slot name is an address client code resolves and cannot be computed.")

    assertOffenses(dedent`
      <p data-herb-name="<%= field %>"><%= message.body %></p>
    `)
  })

  test("flags an empty name", () => {
    expectError("`data-herb-name` on `<p>` must be a static, non-empty value. Write the name out, since a slot name is an address client code resolves and cannot be computed.")

    assertOffenses(dedent`
      <p data-herb-name=""><%= message.body %></p>
    `)
  })

  test("flags two slots sharing a name in one scope", () => {
    expectError("Two slots in the same scope are both named `body`. Rename one of them, since `body` has to resolve to a single slot.")

    assertOffenses(dedent`
      <p data-herb-name="body"><%= @intro %></p>
      <p data-herb-name="body"><%= @outro %></p>
    `)
  })

  test("flags a name colliding with an attribute slot", () => {
    expectError("The name `id` collides with the `id` attribute slot in the same scope. Pick another name, since the attribute is already addressable as `id`.")

    assertOffenses(dedent`
      <li id="<%= dom_id(message) %>">item</li>
      <p data-herb-name="id"><%= message.body %></p>
    `)
  })

  test("flags a name on an element holding nothing dynamic", () => {
    expectError(`\`data-herb-name="body"\` on \`<p>\` names no slot, because the element holds nothing dynamic. Remove the name, or move it onto the element that renders the value.`)

    assertOffenses(dedent`
      <p data-herb-name="body">just static text</p>
    `)
  })
})
