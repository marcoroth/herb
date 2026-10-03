import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbStateNoServerWritesRule } from "../../src/rules/herb-state-no-server-writes.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HerbStateNoServerWritesRule)

describe("HerbStateNoServerWritesRule", () => {
  test("allows a template that never assigns a state", () => {
    expectNoOffenses(dedent`
      <%# herb:state (pending: false, draft: "") %>
      <% copy = draft %>
      <p><%= copy %></p>
      <% if pending? %>Sending<% end %>
    `)
  })

  test("allows a conditional counting fold", () => {
    expectNoOffenses(dedent`
      <%# herb:state (pending_count: 0) %>
      <ul>
        <% @messages.each do |message| %>
          <%# herb:state (pending: false) %>
          <% if pending? %><% pending_count = pending_count + 1 %><% end %>
          <li id="<%= message.id %>"><%= message.body %></li>
        <% end %>
      </ul>
      <p><%= pending_count %></p>
    `)
  })

  test("allows a bare counting fold", () => {
    expectNoOffenses(dedent`
      <%# herb:state (total: 0) %>
      <ul><% @items.each do |item| %><% total += 1 %><li><%= item %></li><% end %></ul>
      <p><%= total %></p>
    `)
  })

  test("flags a plain assignment to a state", () => {
    expectError("`<% pending = true %>` assigns the state `pending`. The client never sees a server-side write, so the value it holds would drift from the one the server rendered. Seed the initial value in the declaration, derive it from other states, count items with `pending += 1` behind a state condition in a keyed loop, or write it at runtime with `data-herb-set` or `state.set`.")

    assertOffenses(dedent`
      <%# herb:state (pending: false) %>
      <% pending = true %>
      <% if pending? %>Sending<% end %>
    `)
  })

  test("flags an increment gated by a server condition", () => {
    expectError("`<% total += 1 %>` assigns the state `total`. The client never sees a server-side write, so the value it holds would drift from the one the server rendered. Seed the initial value in the declaration, derive it from other states, count items with `total += 1` behind a state condition in a keyed loop, or write it at runtime with `data-herb-set` or `state.set`.")

    assertOffenses(dedent`
      <%# herb:state (total: 0) %>
      <ul><% @items.each do |item| %><% if item.big? %><% total += 1 %><% end %><li><%= item %></li><% end %></ul>
      <p><%= total %></p>
    `)
  })

  test("flags an assignment inside an output tag", () => {
    expectError("`<%= draft = \"x\" %>` assigns the state `draft`. The client never sees a server-side write, so the value it holds would drift from the one the server rendered. Seed the initial value in the declaration, derive it from other states, count items with `draft += 1` behind a state condition in a keyed loop, or write it at runtime with `data-herb-set` or `state.set`.")

    assertOffenses(dedent`
      <%# herb:state (draft: "") %>
      <p><%= draft = "x" %></p>
      <input value="<%= draft %>">
    `)
  })

  test("flags a fold into an item state", () => {
    expectError("`mine += 1` counts into `mine`, which is an item state. A count lives once per region, not once per item. Declare `mine` at the top of the template, outside the loop.")

    assertOffenses(dedent`
      <%# herb:slots client %>
      <ul><% @items.each do |item| %><%# herb:state (mine: 0) %><% mine += 1 %><li><%= item %></li><% end %></ul>
    `)
  })

  test("flags a fold into a non-integer state", () => {
    expectError("`label += 1` counts into the String state `label`. A count is a number. Declare `label` as an Integer, like `(label: 0)`.")

    assertOffenses(dedent`
      <%# herb:state (label: "x") %>
      <ul><% @items.each do |item| %><% label += 1 %><li><%= item %></li><% end %></ul>
    `)
  })

  test("flags a fold into a derived state", () => {
    expectError("`busy += 1` counts into `busy`, which is derived from `pending`. A state is either derived or counted, never both. Drop the derivation from `busy`, or count into a second state.")

    assertOffenses(dedent`
      <%# herb:state (pending: false, busy: pending) %>
      <ul><% @items.each do |item| %><% busy += 1 %><li><%= item %></li><% end %></ul>
    `)
  })

  test("flags a state counted twice", () => {
    expectError("`total` is counted twice. One state holds one count. Declare a second state for the second count.")

    assertOffenses(dedent`
      <%# herb:state (total: 0) %>
      <ul><% @items.each do |item| %><% total += 1 %><% total += 1 %><li><%= item %></li><% end %></ul>
      <p><%= total %></p>
    `)
  })

  test("flags a count read before its loop", () => {
    expectError("`total` is read before its count is complete. The server renders that read mid-count and the client cannot keep it current. Move the read below the loop that counts `total`.")

    assertOffenses(dedent`
      <%# herb:state (total: 0) %>
      <p><%= total %></p>
      <ul><% @items.each do |item| %><% total += 1 %><li><%= item %></li><% end %></ul>
    `)
  })

  test("flags a count read inside its loop", () => {
    expectError("`total` is read inside the loop that counts it. The count is complete only after the loop. Move the read below the loop.")

    assertOffenses(dedent`
      <%# herb:state (total: 0) %>
      <ul><% @items.each do |item| %><% total += 1 %><li><%= total %></li><% end %></ul>
    `)
  })

  test("checks nothing in a template with no declarations", () => {
    expectNoOffenses(dedent`
      <% total = 0 %>
      <ul><% @items.each do |item| %><% total += 1 %><li><%= item %></li><% end %></ul>
      <p><%= total %></p>
    `)
  })
})
