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
    expectError("`count.to_s` computes with the state `count`, and the client cannot run Ruby to keep the result current. Show the value with `<%= count %>`, or declare a second state for the computed answer and set it from app code.")

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

  test("allows an ordered comparison on an integer state", () => {
    expectNoOffenses(dedent`
      <%# herb:state (attempts: 0) %>
      <% if attempts > 3 %>Too many<% end %>
      <% if attempts <= 1 %>Fresh<% end %>
    `)
  })

  test("allows comparing two states of one kind", () => {
    expectNoOffenses(dedent`
      <%# herb:state (counter1: 0, counter2: 5) %>
      <% if counter1 > counter2 %>Ahead<% end %>
      <% if counter1 == counter2 %>Tied<% end %>
    `)
  })

  test("flags comparing states of different kinds", () => {
    expectError("`sort == attempts` compares the String state `sort` with the Integer state `attempts`, so it can never match. Compare states of one kind, or redeclare one.")

    assertOffenses(dedent`
      <%# herb:state (sort: "name", attempts: 0) %>
      <% if sort == attempts %>x<% end %>
    `)
  })

  test("flags ordering non-integer states against each other", () => {
    expectError("`sort > other` orders the states `sort` and `other`. Ordering compares numbers, so both have to be Integer states.")

    assertOffenses(dedent`
      <%# herb:state (sort: "name", other: "x") %>
      <% if sort > other %>x<% end %>
    `)
  })

  test("allows a negated equality of the state's own kind", () => {
    expectNoOffenses(dedent`
      <%# herb:state (sort: "name") %>
      <% if sort != "date" %>Named<% end %>
    `)
  })

  test("flags a negated equality against another kind", () => {
    expectError('`sort != 3` compares the String state `sort` against an Integer literal, so it always matches. Compare against a String, or redeclare the state.')

    assertOffenses(dedent`
      <%# herb:state (sort: "name") %>
      <% if sort != 3 %>x<% end %>
    `)
  })

  test("flags ordering a string state", () => {
    expectError("`sort > \"a\"` orders the String state `sort`. Ordering compares numbers, so only an Integer state takes `>`.")

    assertOffenses(dedent`
      <%# herb:state (sort: "name") %>
      <% if sort > "a" %>x<% end %>
    `)
  })

  test("flags ordering against a non-integer literal", () => {
    expectError("`attempts > \"a\"` orders the state `attempts` against a String literal. Ordering compares numbers, so the comparand has to be an Integer.")

    assertOffenses(dedent`
      <%# herb:state (attempts: 0) %>
      <% if attempts > "a" %>x<% end %>
    `)
  })

  test("flags a computed condition", () => {
    expectError("`attempts * 2 > 3` computes with the state `attempts`, and the client cannot run Ruby to pick the branch. Read it bare, `<% if attempts %>`, or compare it to a literal, `attempts == 0`.")

    assertOffenses(dedent`
      <%# herb:state (attempts: 0) %>
      <% if attempts * 2 > 3 %>Too many<% end %>
    `)
  })

  test("allows a state read through unless", () => {
    expectNoOffenses(dedent`
      <%# herb:state (pending: false) %>
      <% unless pending %>Idle<% else %>Busy<% end %>
    `)
  })

  test("flags a computed unless condition", () => {
    expectError("`attempts * 2 > 3` computes with the state `attempts`, and the client cannot run Ruby to pick the branch. Read it bare, `<% if attempts %>`, or compare it to a literal, `attempts == 0`.")

    assertOffenses(dedent`
      <%# herb:state (attempts: 0) %>
      <% unless attempts * 2 > 3 %>Fine<% end %>
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
    expectError('`sort == params[:sort]` compares the state `sort` against something that is not a literal or another declared state. Compare against a literal, like `sort == "name"`, since the client resolves a comparison by lookup.')

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

  test("allows combos of state conditions", () => {
    expectNoOffenses(dedent`
      <%# herb:state (pending: false, failed: false, counter1: 0, counter2: 5) %>
      <% if counter1 > 0 && counter2 < 10 %>In range<% else %>Out<% end %>
      <% if pending? || failed? %>Busy<% else %>Idle<% end %>
      <% unless pending? || failed? %>Free<% end %>
      <% if pending? && (failed? || counter1 > 2) %>Stuck<% end %>
      <input disabled="<%= pending? || failed? %>">
    `)
  })

  test("flags a combo mixing a state with server code", () => {
    expectError("`pending? && current_user.admin?` combines a state with `current_user.admin?`, which the client cannot evaluate. Split the server condition into its own conditional, or compute it into a second state set from app code.")

    assertOffenses(dedent`
      <%# herb:state (pending: false) %>
      <% if pending? && current_user.admin? %>Ready<% else %>Not yet<% end %>
    `)
  })

  test("flags the invalid condition inside a combo once", () => {
    expectError("`attempts?` reads the Integer state `attempts` as a predicate. Write `attempts` bare, or declare a boolean flag. Only a boolean state reads with a `?`.")

    assertOffenses(dedent`
      <%# herb:state (pending: false, attempts: 0) %>
      <% if pending? && attempts? %>x<% end %>
    `)
  })

  test("allows a combo of server conditions", () => {
    expectNoOffenses(dedent`
      <%# herb:state (pending: false) %>
      <% if signed_in? && current_user.admin? %>Admin<% end %>
    `)
  })

  test("infers a derived state's kind for its reads", () => {
    expectNoOffenses(dedent`
      <%# herb:state (pending: false, failed: false, attempts: 0, busy: pending || failed, total: attempts) %>
      <% if busy? %>Busy<% end %>
      <% if total > 3 %>Many<% end %>
    `)
  })

  test("flags a comparison against a derived state's inferred kind", () => {
    expectError("`busy == 3` compares the Boolean state `busy` against an Integer literal, so it can never match. Compare against a Boolean, or redeclare the state.")

    assertOffenses(dedent`
      <%# herb:state (pending: false, failed: false, busy: pending || failed) %>
      <% if busy == 3 %>x<% end %>
    `)
  })

  test("allows tag helper attributes that read a state", () => {
    expectNoOffenses(dedent`
      <%# herb:state (draft: "", agreed: false, pending: false, sort: "name") %>
      <%= tag.input value: draft %>
      <%= tag.input type: "checkbox", checked: agreed %>
      <%= tag.button "Send", disabled: pending? %>
      <%= tag.option "Name", value: "name", selected: sort == "name" %>
    `)
  })

  test("flags a computed tag helper attribute", () => {
    expectError("`draft.upcase` computes with the state `draft`, and the client cannot run Ruby to keep the result current. Show the value with `<%= draft %>`, or declare a second state for the computed answer and set it from app code.")

    assertOffenses(dedent`
      <%# herb:state (draft: "") %>
      <%= tag.input value: draft.upcase %>
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
