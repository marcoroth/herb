import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbStateNoShadowedStatesRule } from "../../src/rules/herb-state-no-shadowed-states.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HerbStateNoShadowedStatesRule)

describe("HerbStateNoShadowedStatesRule", () => {
  test("a block argument named like a state is an offense", () => {
    expectError("Block argument `track` shadows the state `track`, so reads inside this block reach the argument and never the state. Rename the argument.")

    assertOffenses(dedent`
      <%# herb:state (track: "") %>
      <% songs.each do |track| %>
        <p><%= track %></p>
      <% end %>
    `)
  })

  test("a block argument with its own name passes", () => {
    expectNoOffenses(dedent`
      <%# herb:state (track: "") %>
      <% songs.each do |entry| %>
        <p><%= entry %></p>
      <% end %>
    `)
  })

  test("a for loop variable named like a state is an offense", () => {
    expectError("Block argument `item` shadows the state `item`, so reads inside this block reach the argument and never the state. Rename the argument.")

    assertOffenses(dedent`
      <%# herb:state (item: "") %>
      <% for item in list %>
        <p><%= item %></p>
      <% end %>
    `)
  })

  test("a render block argument named like a state is an offense", () => {
    expectError("Block argument `card` shadows the state `card`, so reads inside this block reach the argument and never the state. Rename the argument.")

    assertOffenses(dedent`
      <%# herb:state (card: "") %>
      <%= render layout: "wrap" do |card| %>
        <p><%= card %></p>
      <% end %>
    `)
  })

  test("each argument reports on its own", () => {
    expectError("Block argument `track` shadows the state `track`, so reads inside this block reach the argument and never the state. Rename the argument.")
    expectError("Block argument `number` shadows the state `number`, so reads inside this block reach the argument and never the state. Rename the argument.")

    assertOffenses(dedent`
      <%# herb:state (track: "", number: 0) %>
      <% pairs.each do |track, number| %>
        <p><%= track %> <%= number %></p>
      <% end %>
    `)
  })

  test("a template without a state directive says nothing", () => {
    expectNoOffenses(dedent`
      <% songs.each do |track| %>
        <p><%= track %></p>
      <% end %>
    `)
  })

  test("a name declared by an item directive counts too", () => {
    expectError("Block argument `starred` shadows the state `starred`, so reads inside this block reach the argument and never the state. Rename the argument.")

    assertOffenses(dedent`
      <%# herb:state (open: false) %>
      <% rows.each do |row| %>
        <%# herb:state (starred: false) %>
        <% row.tags.each do |starred| %>
          <p><%= starred %></p>
        <% end %>
      <% end %>
    `)
  })
})
