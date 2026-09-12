import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbStateValidDeclarationRule } from "../../src/rules/herb-state-valid-declaration.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HerbStateValidDeclarationRule)

describe("HerbStateValidDeclarationRule", () => {
  test("allows a declaration with primitive defaults", () => {
    expectNoOffenses(dedent`
      <%# herb:state (pending: false, attempts: 0, sort: "name", tab: :profile, error: nil) %>
      <div></div>
    `)
  })

  test("allows an item-scoped declaration inside a loop", () => {
    expectNoOffenses(dedent`
      <%# herb:state (open: false) %>
      <ul>
        <% @messages.each do |message| %>
          <%# herb:state (pending: false) %>
          <li><%= message.body %></li>
        <% end %>
      </ul>
    `)
  })

  test("allows a bare default naming a declared strict local", () => {
    expectNoOffenses(dedent`
      <%# locals: (open_initially: false) %>
      <%# herb:state (open: open_initially) %>
      <div></div>
    `)
  })

  test("allows a comment that is not a state directive", () => {
    expectNoOffenses(dedent`
      <%# just a comment %>
      <%# herb:disable html-tag-name-lowercase %>
      <div></div>
    `)
  })

  test("flags a state with no default", () => {
    expectError("The state `pending` has no default. The server renders a value for every state, so there is nothing to render or to seed the client with. Give it a default, like `pending: false`.", [1, 16])

    assertOffenses(dedent`
      <%# herb:state (pending:) %>
      <div></div>
    `)
  })

  test("flags a Float default", () => {
    expectError("The state `rate` has a Float default. Ruby and JavaScript disagree on how to print a float, so the server and the client would render different text. Declare it as an Integer or a String instead.", [1, 22])

    assertOffenses(dedent`
      <%# herb:state (rate: 1.0) %>
      <div></div>
    `)
  })

  test("flags a Float default written with an exponent", () => {
    expectError("The state `rate` has a Float default. Ruby and JavaScript disagree on how to print a float, so the server and the client would render different text. Declare it as an Integer or a String instead.", [1, 22])

    assertOffenses(dedent`
      <%# herb:state (rate: 1e3) %>
      <div></div>
    `)
  })

  test("allows an Integer default written in another radix", () => {
    expectNoOffenses(dedent`
      <%# herb:state (mask: 0b1010, color: 0xff, mode: 0o17) %>
      <div></div>
    `)
  })

  test("flags an Array default", () => {
    expectError("The state `selected` has an Array default. A list on the page is a collection of items, not one state holding many values. Declare an item-scoped state inside the loop instead, like `selected: false`.")

    assertOffenses(dedent`
      <%# herb:state (selected: []) %>
      <div></div>
    `)
  })

  test("flags a Hash default", () => {
    expectError('The state `draft` has a Hash default. Declare each leaf as its own state, like `draft_title: ""`.')

    assertOffenses(dedent`
      <%# herb:state (draft: { title: "" }) %>
      <div></div>
    `)
  })

  test("flags a bare default that is not a declared strict local", () => {
    expectError("The state `open` defaults to `open_initially`, which is not a declared strict local. Declare it, like `<%# locals: (open_initially: false) %>`, or use a literal default. A bare name a caller never passed raises a `NameError` at render.")

    assertOffenses(dedent`
      <%# herb:state (open: open_initially) %>
      <div></div>
    `)
  })

  test("flags a state colliding with a strict local", () => {
    expectError("`open` is both a strict local and a state. A local comes from the caller and a state is owned by the client, so the name has two owners. Rename one of the two.")

    assertOffenses(dedent`
      <%# locals: (open: false) %>
      <%# herb:state (open: false) %>
      <div></div>
    `)
  })

  test("flags a state declared twice in the same scope", () => {
    expectError("The state `pending` is declared twice in the same scope. Remove one of the two declarations.")

    assertOffenses(dedent`
      <%# herb:state (pending: false, pending: true) %>
      <div></div>
    `)
  })

  test("flags a state declared twice across two directives in one scope", () => {
    expectError("The state `pending` is declared twice in the same scope. Remove one of the two declarations.")

    assertOffenses(dedent`
      <%# herb:state (pending: false) %>
      <%# herb:state (pending: true) %>
      <div></div>
    `)
  })

  test("flags an item state shadowing a region state", () => {
    expectError("The state `open` is declared in both an item and its region, so a later read could mean either one. Give them different names, like `item_open` for the one inside the loop.")

    assertOffenses(dedent`
      <%# herb:state (open: false) %>
      <% @rows.each do |row| %>
        <%# herb:state (open: false) %>
        <div></div>
      <% end %>
    `)
  })

  test("flags a region state shadowing an earlier item state", () => {
    expectError("The state `open` is declared in both an item and its region, so a later read could mean either one. Give them different names, like `item_open` for the one inside the loop.")

    assertOffenses(dedent`
      <% @rows.each do |row| %>
        <%# herb:state (open: false) %>
        <div></div>
      <% end %>
      <%# herb:state (open: false) %>
    `)
  })

  test("allows two sibling loops declaring the same item state", () => {
    expectNoOffenses(dedent`
      <% @rows.each do |row| %>
        <%# herb:state (open: false) %>
        <div></div>
      <% end %>
      <% @other.each do |row| %>
        <%# herb:state (open: false) %>
        <div></div>
      <% end %>
    `)
  })

  test("flags a signature that is not keyword parameters", () => {
    expectError("`herb:state (pending)` must declare keyword parameters with defaults, like `(pending: false)`.")

    assertOffenses(dedent`
      <%# herb:state (pending) %>
      <div></div>
    `)
  })

  test("flags an unbalanced signature", () => {
    expectError("`herb:state (pending: [false)` does not parse. Declare states as keyword parameters with defaults, like `(pending: false)`.")

    assertOffenses(dedent`
      <%# herb:state (pending: [false) %>
      <div></div>
    `)
  })

  test("allows a string default containing a comma", () => {
    expectNoOffenses(dedent`
      <%# herb:state (greeting: "hello, world") %>
      <div></div>
    `)
  })

  test("allows an expression default", () => {
    expectNoOffenses(dedent`
      <%# herb:state (open: @menu.open?) %>
      <div></div>
    `)
  })
  test("allows derived states over earlier declarations", () => {
    expectNoOffenses(dedent`
      <%# herb:state (pending: false, failed: false, attempts: 0, sort: "name", busy: pending || failed, many: attempts > 2, named: sort == "name", total: attempts, pred: pending?) %>
      <div><% if busy %>B<% end %></div>
      <p><%= total %></p>
      <span><% if many %>M<% end %></span>
      <b><% if named %>N<% end %></b>
      <i><% if pred %>P<% end %></i>
    `)
  })

  test("flags a derived default mixing states with other Ruby", () => {
    expectError("The state `busy` defaults to `pending || current_user.admin?`, which mixes state reads with other Ruby. A derived state reads only other states and a seed reads none. Split the two apart, so `busy` derives from states only.")

    assertOffenses(dedent`
      <%# herb:state (pending: false, busy: pending || current_user.admin?) %>
      <div><% if busy %>B<% end %></div>
    `)
  })

  test("flags a derived state reading forward", () => {
    expectError("The state `busy` reads a state that is declared after it. A derived state reads only states declared before it. Move `busy` after the states it reads.")

    assertOffenses(dedent`
      <%# herb:state (busy: pending || failed, pending: false, failed: false) %>
      <div><% if busy %>B<% end %></div>
    `)
  })

  test("flags an item state deriving from the region", () => {
    expectError("The state `mirror` reads `open` from an enclosing scope. A derived state reads only states from its own signature. Declare `mirror` beside the states it reads.")

    assertOffenses(dedent`
      <%# herb:state (open: false) %>
      <% @rows.each do |row| %>
        <%# herb:state (mirror: open) %>
        <span><% if mirror %>M<% end %></span>
      <% end %>
      <% if open? %>O<% end %>
    `)
  })
})
