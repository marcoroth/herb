import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbStateValidReadsRule } from "../../src/rules/herb-state-valid-reads.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HerbStateValidReadsRule)

describe("HerbStateValidReadsRule", () => {
  test("allows bare reads, predicates, equality and case over a state", () => {
    expectNoOffenses(dedent`
      <%# herb:state (pending: false, attempts: 0, sort: "name") %>
      <p><%= attempts %></p>
      <% if pending? %>Sending<% else %>Sent<% end %>
      <% if sort == "name" %>By name<% elsif sort == "date" %>By date<% end %>
      <% case sort %>
      <% when "name" %>By name
      <% when "date" %>By date
      <% end %>
    `)
  })

  test("allows expressions that mention no state", () => {
    expectNoOffenses(dedent`
      <%# herb:state (pending: false) %>
      <% if current_user.admin? %>Admin<% end %>
      <p><%= message.body %></p>
    `)
  })

  test("allows a state named in a tag helper's action attribute", () => {
    expectNoOffenses(dedent`
      <%# herb:state (count: 0) %>
      <%= tag.button "More", data: { herb_increment: "count" } %>
    `)
  })

  test("still flags a state read beside an action attribute", () => {
    expectError("`tag.button \"More\", data: { herb_increment: \"count\" }, title: count.to_s` computes with the state `count`, and the client cannot run Ruby to keep the result current. Show the value with `<%= count %>`, or declare a second state for the computed answer and set it from app code.")

    assertOffenses(dedent`
      <%# herb:state (count: 0) %>
      <%= tag.button "More", data: { herb_increment: "count" }, title: count.to_s %>
    `)
  })

  test("flags a computed value read", () => {
    expectError("`attempts + 1` computes with the state `attempts`, and the client cannot run Ruby to keep the result current. Show the value with `<%= attempts %>`, or declare a second state for the computed answer and set it from app code.")

    assertOffenses(dedent`
      <%# herb:state (attempts: 0) %>
      <p><%= attempts + 1 %></p>
    `)
  })

  test("allows a state as an interpolated attribute's only output", () => {
    expectNoOffenses(dedent`
      <%# herb:state (status: "") %>
      <div class="row-<%= status %>">x</div>
    `)
  })

  test("flags a state mixed with other dynamics in an interpolated attribute", () => {
    expectError("`status` reads a state inside an interpolated attribute that mixes other dynamic parts. Give the state its own attribute or its own output, since a state write cannot supply the other values.")

    assertOffenses(dedent`
      <%# herb:state (status: "") %>
      <div class="row-<%= status %>-<%= @kind %>">x</div>
    `)
  })

  test("flags a negated condition the way it flags not", () => {
    expectError("`!open` computes with the state `open`, and the client cannot run Ruby to pick the branch. Read it bare, `<% if open %>`, or as `open?`.")

    assertOffenses(dedent`
      <%# herb:state (open: false) %>
      <% if !open %>Closed<% end %>
    `)
  })

  test("flags a computed condition", () => {
    expectError("`attempts > 3` computes with the state `attempts`, and the client cannot run Ruby to pick the branch. Read it bare, `<% if attempts %>`, or compare it to a literal, `attempts == 0`.")

    assertOffenses(dedent`
      <%# herb:state (attempts: 0) %>
      <% if attempts > 3 %>Too many<% end %>
    `)
  })

  test("allows a state read through unless", () => {
    expectNoOffenses(dedent`
      <%# herb:state (pending: false) %>
      <% unless pending %>Idle<% else %>Busy<% end %>
    `)
  })

  test("flags a computed unless condition", () => {
    expectError("`attempts > 3` computes with the state `attempts`, and the client cannot run Ruby to pick the branch. Read it bare, `<% if attempts %>`, or compare it to a literal, `attempts == 0`.")

    assertOffenses(dedent`
      <%# herb:state (attempts: 0) %>
      <% unless attempts > 3 %>Fine<% end %>
    `)
  })

  test("flags a predicate on a non-boolean state", () => {
    expectError("`attempts?` reads the Integer state `attempts` as a predicate. Write `attempts` bare, or declare a boolean flag. Only a boolean state reads with a `?`.")

    assertOffenses(dedent`
      <%# herb:state (attempts: 0) %>
      <% if attempts? %>Tried<% end %>
    `)
  })

  test("flags a comparison against a non-literal", () => {
    expectError('`sort == params[:sort]` compares the state `sort` against something that is not a literal. Compare against a literal, like `sort == "name"`, since the client resolves a comparison by lookup.')

    assertOffenses(dedent`
      <%# herb:state (sort: "name") %>
      <% if sort == params[:sort] %>Current<% end %>
    `)
  })

  test("flags a comparison against a literal of another type", () => {
    expectError("`sort == 3` compares the String state `sort` against an Integer literal, so it can never match. Compare against a String, or redeclare the state.")

    assertOffenses(dedent`
      <%# herb:state (sort: "name") %>
      <% if sort == 3 %>Odd<% end %>
    `)
  })

  test("allows a comparison against nil for any kind", () => {
    expectNoOffenses(dedent`
      <%# herb:state (error: nil, sort: "name") %>
      <% if sort == nil %>Unset<% end %>
    `)
  })

  test("flags a symbol state compared against a string", () => {
    expectError("`tab == \"profile\"` compares the Symbol state `tab` against a String literal, so it can never match. Compare against a Symbol, or redeclare the state.")

    assertOffenses(dedent`
      <%# herb:state (tab: :profile) %>
      <% if tab == "profile" %>Profile<% end %>
    `)
  })

  test("flags a stateless arm inside a state-driven conditional", () => {
    expectError("`current_user.admin?` sits in a state-driven conditional but reads no state. Move it into its own conditional, or read a state in this arm, since the client resolves every arm itself.")

    assertOffenses(dedent`
      <%# herb:state (pending: false) %>
      <% if pending? %>Sending<% elsif current_user.admin? %>Admin<% else %>Sent<% end %>
    `)
  })

  test("allows a server conditional whose first arm reads no state", () => {
    expectNoOffenses(dedent`
      <%# herb:state (pending: false) %>
      <% if current_user.admin? %>Admin<% else %>Member<% end %>
    `)
  })

  test("flags a case that does not switch on a bare state read", () => {
    expectError("`case sort.downcase` does not switch on a bare state read. Write the state alone, or compute the value into its own state.")

    assertOffenses(dedent`
      <%# herb:state (sort: "name") %>
      <% case sort.downcase %>
      <% when "name" %>By name
      <% end %>
    `)
  })

  test("flags a when comparand that is not a literal", () => {
    expectError('`when other_sort` on the state `sort` has a comparand that is not a literal. List literals, like `when "name", "date"`, since the client resolves a `when` by lookup.')

    assertOffenses(dedent`
      <%# herb:state (sort: "name") %>
      <% case sort %>
      <% when other_sort %>Other
      <% end %>
    `)
  })

  test("flags a when comparand of another type", () => {
    expectError("`when 3` compares the String state `sort` against a literal of another type, so it can never match. Use String literals in every arm.")

    assertOffenses(dedent`
      <%# herb:state (sort: "name") %>
      <% case sort %>
      <% when 3 %>Odd
      <% end %>
    `)
  })

  test("checks nothing in a template with no declarations", () => {
    expectNoOffenses(dedent`
      <% if attempts > 3 %>Too many<% end %>
      <p><%= attempts + 1 %></p>
    `)
  })

  test("allows state reads in a boolean attribute", () => {
    expectNoOffenses(dedent`
      <%# herb:state (draft: "", sending: false) %>
      <p><%= draft %></p>
      <button disabled="<%= draft == "" %>">Send</button>
      <video muted="<%= sending %>"></video>
      <audio loop="<%= sending? %>"></audio>
    `)
  })

  test("flags a mismatched comparand in a boolean attribute", () => {
    expectError("`draft == 3` compares the String state `draft` against an Integer literal, so it can never match. Compare against a String, or redeclare the state.")

    assertOffenses(dedent`
      <%# herb:state (draft: "") %>
      <p><%= draft %></p>
      <button disabled="<%= draft == 3 %>">Send</button>
    `)
  })

  test("flags a computed read in a boolean attribute", () => {
    expectError('`draft.empty?` computes with the state `draft`, and the client cannot run Ruby to pick the branch. Read it bare, `<% if draft %>`, or compare it to a literal, `draft == ""`.')

    assertOffenses(dedent`
      <%# herb:state (draft: "") %>
      <p><%= draft %></p>
      <button disabled="<%= draft.empty? %>">Send</button>
    `)
  })

  test("still flags equality in an attribute that is not boolean", () => {
    expectError('`draft == ""` computes with the state `draft`, and the client cannot run Ruby to keep the result current. Show the value with `<%= draft %>`, or declare a second state for the computed answer and set it from app code.')

    assertOffenses(dedent`
      <%# herb:state (draft: "") %>
      <p><%= draft %></p>
      <button title="<%= draft == "" %>">Send</button>
    `)
  })

  test("scopes item states to their loop", () => {
    expectNoOffenses(dedent`
      <% @rows.each do |row| %>
        <%# herb:state (starred: false) %>
        <% if starred? %>Starred<% end %>
      <% end %>
      <% if starred %>Outside<% end %>
    `)
  })
})
