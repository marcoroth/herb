import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbIntoRequiresCollectionRule } from "../../src/rules/herb-into-requires-collection.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HerbIntoRequiresCollectionRule)

describe("HerbIntoRequiresCollectionRule", () => {
  test("allows a form naming a keyed collection", () => {
    expectNoOffenses(dedent`
      <ul data-herb-name="messages">
        <% @messages.each do |message| %>
          <%# herb:key message.id %>
          <li><%= message.body %></li>
        <% end %>
      </ul>
      <form action="/messages" method="post" data-herb-into="messages"></form>
    `)
  })

  test("allows a collection keyed by its id attribute", () => {
    expectNoOffenses(dedent`
      <ul data-herb-name="messages">
        <% @messages.each do |message| %>
          <li id="<%= dom_id(message) %>"><%= message.body %></li>
        <% end %>
      </ul>
      <form action="/messages" method="post" data-herb-into="messages"></form>
    `)
  })

  test("allows a template with no send target at all", () => {
    expectNoOffenses(dedent`
      <ul data-herb-name="messages"><% @messages.each do |message| %><li><%= message.body %></li><% end %></ul>
    `)
  })

  test("flags a target nothing names, listing the collections", () => {
    expectError("`data-herb-into=\"posts\"` names nothing in this template. Name a keyed collection with `data-herb-name` on the element around the loop. Collections in this template: `messages`.")

    assertOffenses(dedent`
      <ul data-herb-name="messages">
        <% @messages.each do |message| %>
          <%# herb:key message.id %>
          <li><%= message.body %></li>
        <% end %>
      </ul>
      <form action="/messages" method="post" data-herb-into="posts"></form>
    `)
  })

  test("flags a target naming a slot that is not a collection", () => {
    expectError("`data-herb-into=\"summary\"` names a slot that is not a keyed collection. A send inserts an item, so name the element around a keyed loop.")

    assertOffenses(dedent`
      <p data-herb-name="summary"><%= @summary %></p>
      <form action="/messages" method="post" data-herb-into="summary"></form>
    `)
  })

  test("flags a target naming an unkeyed loop", () => {
    expectError("`data-herb-into=\"messages\"` names a slot that is not a keyed collection. A send inserts an item, so name the element around a keyed loop.")

    assertOffenses(dedent`
      <ul data-herb-name="messages">
        <% @messages.each do |message| %>
          <li><%= message.body %></li>
        <% end %>
      </ul>
      <form action="/messages" method="post" data-herb-into="messages"></form>
    `)
  })

  test("flags a dynamic target", () => {
    expectError("`data-herb-into` must be a static, non-empty value. Write the collection's name out, since a send target is an address client code resolves.")

    assertOffenses(dedent`
      <ul data-herb-name="messages">
        <% @messages.each do |message| %>
          <%# herb:key message.id %>
          <li><%= message.body %></li>
        <% end %>
      </ul>
      <form action="/messages" method="post" data-herb-into="<%= target %>"></form>
    `)
  })
})
