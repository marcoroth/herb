import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbStateNoSilentReadsRule } from "../../src/rules/herb-state-no-silent-reads.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HerbStateNoSilentReadsRule)

describe("HerbStateNoSilentReadsRule", () => {
  test("allows every read that does something", () => {
    expectNoOffenses(dedent`
      <%# herb:slots client %>
      <%# herb:state (pending: false, draft: "") %>
      <p><%= draft %></p>
      <% if pending? %>Sending<% else %>Sent<% end %>
      <% unless pending %>Idle<% end %>
    `)
  })

  test("allows silent tags that are not bare reads", () => {
    expectNoOffenses(dedent`
      <%# herb:state (draft: "") %>
      <% copy = draft %>
      <% draft.upcase %>
      <p><%= copy %></p>
    `)
  })

  test("allows a bare silent expression that is not a state", () => {
    expectNoOffenses(dedent`
      <%# herb:state (draft: "") %>
      <% helper_call %>
      <p><%= draft %></p>
    `)
  })

  test("stays quiet outside the declaring scope", () => {
    expectNoOffenses(dedent`
      <%# herb:slots client %>
      <% @rows.each do |row| %>
        <%# herb:state (selected: false) %>
        <input type="checkbox" checked="<%= selected %>">
      <% end %>
      <% selected %>
    `)
  })

  test("flags a bare state read in a silent tag", () => {
    expectError("`<% draft %>` reads the state `draft` and discards the value, so it renders nothing and changes nothing. Show it with `<%= draft %>`, or write it from markup with `data-herb-set`.")

    assertOffenses(dedent`
      <%# herb:slots client %>
      <%# herb:state (draft: "") %>
      <% draft %>
      <input value="<%= draft %>">
    `)
  })

  test("flags a predicate spelling too", () => {
    expectError("`<% pending? %>` reads the state `pending` and discards the value, so it renders nothing and changes nothing. Show it with `<%= pending %>`, or write it from markup with `data-herb-set`.")

    assertOffenses(dedent`
      <%# herb:state (pending: false) %>
      <% pending? %>
      <% if pending? %>Sending<% end %>
    `)
  })

  test("flags an item state read inside its loop", () => {
    expectError("`<% selected %>` reads the state `selected` and discards the value, so it renders nothing and changes nothing. Show it with `<%= selected %>`, or write it from markup with `data-herb-set`.")

    assertOffenses(dedent`
      <%# herb:slots client %>
      <% @rows.each do |row| %>
        <%# herb:state (selected: false) %>
        <% selected %>
        <input type="checkbox" checked="<%= selected %>">
      <% end %>
    `)
  })
})
