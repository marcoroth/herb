import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbStateNoUnusedStatesRule } from "../../src/rules/herb-state-no-unused-states.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HerbStateNoUnusedStatesRule)

describe("HerbStateNoUnusedStatesRule", () => {
  test("does not flag a state whose only read is negated", () => {
    expectNoOffenses(dedent`
      <%# herb:state (open: false) %>
      <% if !open %>Closed<% end %>
    `)
  })

  test("allows a state read in a conditional", () => {
    expectNoOffenses(dedent`
      <%# herb:state (open: false) %>
      <% if open? %>Open<% end %>
    `)
  })

  test("allows a state read as a value", () => {
    expectNoOffenses(dedent`
      <%# herb:state (attempts: 0) %>
      <p><%= attempts %></p>
    `)
  })

  test("allows a state written by an action attribute", () => {
    expectNoOffenses(dedent`
      <%# herb:state (open: false) %>
      <button data-herb-toggle="open">Details</button>
    `)
  })

  test("allows a state written inside a set pair", () => {
    expectNoOffenses(dedent`
      <%# herb:state (pending: false, failed: false) %>
      <button data-herb-set="pending=false,failed=true">Fail</button>
    `)
  })

  test("allows a state bound to a form control", () => {
    expectNoOffenses(dedent`
      <%# herb:state (draft: "") %>
      <input value="<%= draft %>">
    `)
  })

  test("allows a use above the declaration", () => {
    expectNoOffenses(dedent`
      <% if open? %>Open<% end %>
      <%# herb:state (open: false) %>
    `)
  })

  test("flags a state nothing reads or writes", () => {
    expectWarning("The state `stale` is never read or written in this template. Remove it, or disable this line when only app code uses it through `stateFor` or `useState`.")

    assertOffenses(dedent`
      <%# herb:state (open: false, stale: true) %>
      <% if open? %>Open<% end %>
    `)
  })

  test("does not count an item-scoped use for a name outside its loop", () => {
    expectWarning("The state `starred` is never read or written in this template. Remove it, or disable this line when only app code uses it through `stateFor` or `useState`.")

    assertOffenses(dedent`
      <%# herb:state (starred: false) %>
      <% @rows.each do |row| %>
        <%# herb:state (highlighted: false) %>
        <% if highlighted? %>Bright<% end %>
      <% end %>
    `)
  })

  test("counts a region state used inside a loop", () => {
    expectNoOffenses(dedent`
      <%# herb:state (editing: false) %>
      <% @rows.each do |row| %>
        <% if editing? %>Editing<% end %>
      <% end %>
    `)
  })
})
