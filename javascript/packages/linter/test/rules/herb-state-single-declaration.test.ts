import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbStateSingleDeclarationRule } from "../../src/rules/herb-state-single-declaration.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HerbStateSingleDeclarationRule)

describe("HerbStateSingleDeclarationRule", () => {
  test("allows one declaration per scope", () => {
    expectNoOffenses(dedent`
      <%# herb:slots client %>
      <%# herb:state (open: false) %>
      <% @rows.each do |row| %>
        <%# herb:state (selected: false) %>
        <input type="checkbox" checked="<%= selected %>">
      <% end %>
      <% if open? %><nav>menu</nav><% end %>
    `)
  })

  test("allows sibling loops to declare their own states", () => {
    expectNoOffenses(dedent`
      <%# herb:slots client %>
      <% @left.each do |row| %>
        <%# herb:state (starred: false) %>
        <span><% if starred %>on<% end %></span>
      <% end %>
      <% @right.each do |row| %>
        <%# herb:state (starred: false) %>
        <span><% if starred %>on<% end %></span>
      <% end %>
    `)
  })

  test("flags a second declaration in the region", () => {
    expectWarning("This scope already declares its states in the `herb:state` directive on line 2. Merge these states into that signature, so every state of the scope reads from one declaration.")

    assertOffenses(dedent`
      <%# herb:slots client %>
      <%# herb:state (open: false) %>
      <%# herb:state (draft: "") %>
      <% if open? %><nav>menu</nav><% end %>
      <input value="<%= draft %>">
    `)
  })

  test("flags a second declaration in a loop body", () => {
    expectWarning("This scope already declares its states in the `herb:state` directive on line 3. Merge these states into that signature, so every state of the scope reads from one declaration.")

    assertOffenses(dedent`
      <%# herb:slots client %>
      <% @rows.each do |row| %>
        <%# herb:state (selected: false) %>
        <%# herb:state (editing: false) %>
        <input type="checkbox" checked="<%= selected %>">
        <span><% if editing %>edit<% end %></span>
      <% end %>
    `)
  })

  test("flags every declaration after the first", () => {
    expectWarning("This scope already declares its states in the `herb:state` directive on line 1. Merge these states into that signature, so every state of the scope reads from one declaration.")
    expectWarning("This scope already declares its states in the `herb:state` directive on line 1. Merge these states into that signature, so every state of the scope reads from one declaration.")

    assertOffenses(dedent`
      <%# herb:state (a: false) %>
      <%# herb:state (b: false) %>
      <%# herb:state (c: false) %>
      <% if a %>x<% end %><% if b %>y<% end %><% if c %>z<% end %>
    `)
  })
})
