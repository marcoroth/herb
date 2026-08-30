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
    expectError("`count + 1` computes with the state `count`, and the client cannot run Ruby to keep the result current. Show the value with `<%= count %>`, or declare a second state for the computed answer and set it from app code.")

    assertOffenses(dedent`
      <%# herb:state (count: 0) %>
      <%= tag.button "More", data: { herb_increment: "count" }, title: count + 1 %>
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

  test("allows the `?` spelling on a state of any kind", () => {
    expectNoOffenses(dedent`
      <%# herb:state (attempts: 0, draft: "", tab: :first, shown: draft?) %>
      <% if attempts? %>Tried<% end %>
      <% if draft? %>Drafted<% end %>
      <% if tab? %>Tabbed<% end %>
      <% if shown %>Shown<% end %>
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
    expectError("`attempts.empty?` reads the Integer state `attempts` with `empty?`. Only a String or a Symbol state can be read with `empty?`, so compare `attempts` to a literal instead.")

    assertOffenses(dedent`
      <%# herb:state (pending: false, attempts: 0) %>
      <% if pending? && attempts.empty? %>x<% end %>
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
    expectError('`draft.upcase` computes with the state `draft`, and the client cannot run Ruby to pick the branch. Read it bare, `<% if draft %>`, or compare it to a literal, `draft == ""`.')

    assertOffenses(dedent`
      <%# herb:state (draft: "") %>
      <p><%= draft %></p>
      <button disabled="<%= draft.upcase %>">Send</button>
    `)
  })

  test("allows a predicate read in a boolean attribute", () => {
    expectNoOffenses(dedent`
      <%# herb:state (draft: "") %>
      <p><%= draft %></p>
      <button disabled="<%= draft.empty? %>">Send</button>
    `)
  })

  test("allows equality in an attribute that is not boolean", () => {
    expectNoOffenses(dedent`
      <%# herb:state (draft: "") %>
      <p><%= draft %></p>
      <button title="<%= draft == "" %>">Send</button>
    `)
  })

  test("allows a comparison as an output", () => {
    expectNoOffenses(dedent`
      <%# herb:state (draft: "") %>
      <p><%= draft == "hello" %></p>
    `)
  })

  test("allows a negated read", () => {
    expectNoOffenses(dedent`
      <%# herb:state (sending: false, draft: "", count: 0, idle: !sending) %>
      <% if !sending %>a<% end %>
      <% if !sending? %>b<% end %>
      <% if not sending %>c<% end %>
      <% if !draft.blank? %>d<% end %>
      <% if !(count > 3) %>e<% end %>
      <% if !count.zero? %>f<% end %>
      <% if !sending && count.zero? %>g<% end %>
      <% if idle %>h<% end %>
      <button disabled="<%= !sending %>">Send</button>
      <p><%= !sending %></p>
    `)
  })

  test("allows a negated combination", () => {
    expectNoOffenses(dedent`
      <%# herb:state (sending: false, draft: "", count: 0) %>
      <% if !(sending && draft == "hi") %>a<% end %>
      <% if !(sending || draft == "hi") %>b<% end %>
      <% if !((draft.length > count) && !(draft == "abc" || count == 0)) %>c<% end %>
    `)
  })

  test("allows a predicate combined with a comparison", () => {
    expectNoOffenses(dedent`
      <%# herb:state (sending: false, draft: "", count: 0) %>
      <% if sending? && draft == "hello" %>a<% end %>
      <% if sending? || draft.blank? %>b<% end %>
      <% if sending? && draft.present? && count.zero? %>c<% end %>
      <% if sending? && (draft == "hello" || count.one?) %>d<% end %>
      <button disabled="<%= sending? && draft == "hello" %>">Send</button>
      <p><%= sending? && draft == "hello" %></p>
    `)
  })

  test("allows a default derived from a predicate combined with a comparison", () => {
    expectNoOffenses(dedent`
      <%# herb:state (sending: false, draft: "", ready: sending? && draft == "hello") %>
      <% if ready %>Ready<% end %>
    `)
  })

  test("allows to_s on a state of any kind", () => {
    expectNoOffenses(dedent`
      <%# herb:state (draft: 3, filter: "all", open: false, note: nil, tab: :first, text: draft.to_s) %>
      <% if draft.to_s == filter %>a<% end %>
      <% if filter == draft.to_s %>b<% end %>
      <% if open.to_s == "true" %>c<% end %>
      <% if note.to_s == "" %>d<% end %>
      <% if tab.to_s == "first" %>e<% end %>
      <p><%= draft.to_s %></p>
      <p><%= text %></p>
    `)
  })

  test("allows a transform compared against another state", () => {
    expectNoOffenses(dedent`
      <%# herb:state (draft: "", count: 0) %>
      <% if draft.length > count %>a<% end %>
      <% if count < draft.length %>b<% end %>
    `)
  })

  test("allows a transform on both sides of a comparison", () => {
    expectNoOffenses(dedent`
      <%# herb:state (draft: "", other: "", longer: draft.length > other.length) %>
      <% if draft.length > other.length %>a<% end %>
      <% if draft.to_s == other.to_s %>b<% end %>
      <% if !(draft.length > other.length) %>c<% end %>
      <% if longer %>d<% end %>
      <p><%= draft.length > other.length %></p>
    `)
  })

  test("flags two transformed sides whose kinds disagree", () => {
    expectError("`draft.length > other.to_s` orders the length of the state `draft` against the to_s of the state `other`. Ordering compares numbers, so both sides have to be Integers.")

    assertOffenses(dedent`
      <%# herb:state (draft: "", other: "") %>
      <% if draft.length > other.to_s %>a<% end %>
    `)
  })

  test("flags a transform compared against a state of another kind", () => {
    expectError("`draft.length > filter` compares the length of the state `draft` with the String state `filter`, so it can never match. Compare values of the same kind.")

    assertOffenses(dedent`
      <%# herb:state (draft: "", filter: "all") %>
      <% if draft.length > filter %>a<% end %>
    `)
  })

  test("allows length and size compared against an Integer", () => {
    expectNoOffenses(dedent`
      <%# herb:state (draft: "", tab: :first, count: 0, width: draft.length) %>
      <% if draft.length > 3 %>a<% end %>
      <% if draft.size == 0 %>b<% end %>
      <% if 3 < draft.length %>c<% end %>
      <% if tab.length > 2 %>d<% end %>
      <% if draft.length > 3 && count.zero? %>e<% end %>
      <p><%= draft.length %></p>
      <p><%= width %></p>
      <button disabled="<%= draft.length > 3 %>">Send</button>
    `)
  })

  test("flags length on a state that is not a String or a Symbol", () => {
    expectError("`count.length` reads the Integer state `count` with `length`. Only a String or a Symbol state can be read with `length`, so compare `count` itself instead.")

    assertOffenses(dedent`
      <%# herb:state (count: 0) %>
      <% if count.length > 3 %>a<% end %>
    `)
  })

  test("flags a length compared against a literal of another type", () => {
    expectError('`draft.length == "x"` compares the length of the state `draft` against a String literal, so it can never match. Compare it against an Integer literal instead.')

    assertOffenses(dedent`
      <%# herb:state (draft: "") %>
      <% if draft.length == "x" %>a<% end %>
    `)
  })

  test("allows every supported predicate on a state of its kind", () => {
    expectNoOffenses(dedent`
      <%# herb:state (draft: "", count: 0, open: false, note: nil) %>
      <% if count.positive? %>Some<% end %>
      <% if draft.blank? %>Blank<% end %>
      <% if draft.present? %>Present<% end %>
      <% if draft.empty? %>Empty<% end %>
      <% if count.zero? %>None<% end %>
      <% if count.one? %>One<% end %>
      <% if open.nil? %>Unset<% end %>
      <% if note.blank? %>No note<% end %>
    `)
  })

  test("flags zero? on a state that is not an Integer", () => {
    expectError("`draft.zero?` reads the String state `draft` with `zero?`. Only an Integer state can be read with `zero?`, so compare `draft` to a literal instead.")

    assertOffenses(dedent`
      <%# herb:state (draft: "") %>
      <% if draft.zero? %>None<% end %>
    `)
  })

  test("flags one? on a state that is not an Integer", () => {
    expectError("`draft.one?` reads the String state `draft` with `one?`. Only an Integer state can be read with `one?`, so compare `draft` to a literal instead.")

    assertOffenses(dedent`
      <%# herb:state (draft: "") %>
      <% if draft.one? %>One<% end %>
    `)
  })

  test("flags empty? on a state that is not a String or a Symbol", () => {
    expectError("`count.empty?` reads the Integer state `count` with `empty?`. Only a String or a Symbol state can be read with `empty?`, so compare `count` to a literal instead.")

    assertOffenses(dedent`
      <%# herb:state (count: 0) %>
      <% if count.empty? %>None<% end %>
    `)
  })

  test("flags blank? on a state that is never blank", () => {
    expectError("`count.blank?` reads the Integer state `count` with `blank?`. Only a Boolean, a String or a Nil state can be read with `blank?`, so compare `count` to a literal instead.")

    assertOffenses(dedent`
      <%# herb:state (count: 0) %>
      <% if count.blank? %>None<% end %>
    `)
  })

  test("flags present? on a state that is always present", () => {
    expectError("`tab.present?` reads the Symbol state `tab` with `present?`. Only a Boolean, a String or a Nil state can be read with `present?`, so compare `tab` to a literal instead.")

    assertOffenses(dedent`
      <%# herb:state (tab: :first) %>
      <% if tab.present? %>Tab<% end %>
    `)
  })

  test("flags a method that is not a supported predicate", () => {
    expectError("`draft.upcase?` computes with the state `draft`, and the client cannot run Ruby to pick the branch. Read it bare, `<% if draft %>`, or compare it to a literal, `draft == \"\"`.")

    assertOffenses(dedent`
      <%# herb:state (draft: "") %>
      <% if draft.upcase? %>Loud<% end %>
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
