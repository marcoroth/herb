import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbStateValidActionsRule } from "../../src/rules/herb-state-valid-actions.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HerbStateValidActionsRule)

describe("HerbStateValidActionsRule", () => {
  test("a trailing comma reads as an empty clause", () => {
    expectError("`data-herb-set` has an empty clause. Remove the stray comma or space, since every clause has to be a `state=value` pair.")

    assertOffenses(dedent`
      <%# herb:state (open: false) %>
      <button data-herb-set="open=true,">x</button>
    `)
  })

  test("allows well-formed actions against declared states", () => {
    expectNoOffenses(dedent`
      <%# herb:state (open: false, attempts: 0, sort: "name", draft: "") %>
      <button data-herb-toggle="open">Details</button>
      <button data-herb-set="open=true,sort=date">Fail</button>
      <button data-herb-increment="attempts" data-herb-by="2">More</button>
      <select data-herb-set="change->sort=$value"></select>
      <input data-herb-reset="blur->draft">
      <div data-herb-set="mouseenter->open=true mouseleave->open=false">hover</div>
      <button data-herb-set="draft='hello, world'">Quote</button>
    `)
  })

  test("allows an action value containing ERB output", () => {
    expectNoOffenses(dedent`
      <%# herb:state (open: false) %>
      <button data-herb-set="editing_id=<%= message.id %>">Edit</button>
    `)
  })

  test("allows actions when the template declares no states", () => {
    expectNoOffenses(dedent`
      <button data-herb-toggle="open">Details</button>
    `)
  })

  test("flags an unbalanced quote", () => {
    expectError(`\`data-herb-set="sort='oops"\` has an unbalanced quote. Close the \`'\`, since separators inside quotes stay literal.`)

    assertOffenses(dedent`
      <%# herb:state (sort: "name") %>
      <button data-herb-set="sort='oops">Sort</button>
    `)
  })

  test("allows key filters in the Stimulus syntax", () => {
    expectNoOffenses(dedent`
      <%# herb:state (open: false) %>
      <button data-herb-set="keydown.esc@window->open=false keydown.ctrl+shift+f@document->open=true meta+click->open=true click@outside->open=false">x</button>
    `)
  })

  test("points the old dot chord at the plus form", () => {
    expectError("`keydown.meta.k@window` in `data-herb-set` joins its filter with `.`. Join modifiers and key with `+`, like `keydown.meta+k`.")

    assertOffenses(dedent`
      <%# herb:state (open: false) %>
      <button data-herb-set="keydown.meta.k@window->open=true">x</button>
    `)
  })

  test("flags a target the runtime will never listen on", () => {
    expectError("`keydown.esc@body` in `data-herb-set` names `@body` as its target. Use `@window`, `@document` or `@outside`, or drop the target to listen on the element.")

    assertOffenses(dedent`
      <%# herb:state (open: false) %>
      <button data-herb-set="keydown.esc@body->open=false">x</button>
    `)
  })

  test("flags a filter naming two keys", () => {
    expectError("`keydown.a+b` in `data-herb-toggle` filters on 2 keys. Name one key per clause, with modifiers joined by `+`, like `keydown.ctrl+k`.")

    assertOffenses(dedent`
      <%# herb:state (open: false) %>
      <button data-herb-toggle="keydown.a+b->open">x</button>
    `)
  })

  test("flags a prefix that is not a modifier", () => {
    expectError("`primary+click` in `data-herb-set` prefixes the event with `primary+`, which is not a modifier. Use `ctrl`, `alt`, `shift`, `meta` or `cmd`.")

    assertOffenses(dedent`
      <%# herb:state (open: false) %>
      <button data-herb-set="primary+click->open=true">x</button>
    `)
  })

  test("flags an empty key filter", () => {
    expectError("`keydown.` in `data-herb-set` has an empty key filter. Name the key after the dot, like `keydown.esc`, or drop the dot.")

    assertOffenses(dedent`
      <%# herb:state (open: false) %>
      <button data-herb-set="keydown.->open=true">x</button>
    `)
  })

  test("flags a clause with no event before the arrow", () => {
    expectError("`data-herb-toggle` has a clause with no event before the arrow. Name one, like `click->`, or drop the arrow to use the element's default event.")

    assertOffenses(dedent`
      <%# herb:state (open: false) %>
      <button data-herb-toggle="->open">Details</button>
    `)
  })

  test("flags a clause with nothing after the event", () => {
    expectError("`data-herb-toggle` has a clause with nothing after the event. Name the state to write, like `click->open`.")

    assertOffenses(dedent`
      <%# herb:state (open: false) %>
      <button data-herb-toggle="click->">Details</button>
    `)
  })

  test("allows a bare reset clause", () => {
    expectNoOffenses(dedent`
      <%# herb:state (draft: "") %>
      <button data-herb-reset="">Clear</button>
    `)
  })

  test("flags an assignment that is not a pair", () => {
    expectError("`pending` in `data-herb-set` is not a `state=value` pair. Write the value to set, like `pending=true`, or use `data-herb-toggle` to flip a boolean.")

    assertOffenses(dedent`
      <%# herb:state (pending: false) %>
      <button data-herb-set="pending">Send</button>
    `)
  })

  test("flags a state nothing declares, listing the scope", () => {
    expectError("Nothing in scope here declares the state `missing`. Declare it with `<%# herb:state (missing: ...) %>`, or use one of the states in scope. States in scope: `open`.")

    assertOffenses(dedent`
      <%# herb:state (open: false) %>
      <button data-herb-toggle="missing">Details</button>
    `)
  })

  test("flags toggle on a non-boolean", () => {
    expectError('`data-herb-toggle` on `sort` can never work, because `sort` is a String and it needs a Boolean. Set a value instead, like `data-herb-set="sort=..."`, or declare a boolean flag.')

    assertOffenses(dedent`
      <%# herb:state (sort: "name") %>
      <button data-herb-toggle="sort">Sort</button>
    `)
  })

  test("flags increment on a non-integer", () => {
    expectError("`data-herb-increment` on `open` can never work, because `open` is a Boolean and it needs an Integer. Declare it as an Integer, like `(open: 0)`.")

    assertOffenses(dedent`
      <%# herb:state (open: false) %>
      <button data-herb-increment="open">More</button>
    `)
  })

  test("flags a set value that does not parse to the declared kind", () => {
    expectError("`attempts=lots` does not parse as an Integer, and `attempts` is declared as one. Use a whole number, like `attempts=0`.")

    assertOffenses(dedent`
      <%# herb:state (attempts: 0) %>
      <button data-herb-set="attempts=lots">More</button>
    `)
  })

  test("flags a boolean set to a non-boolean value", () => {
    expectError("`pending=maybe` does not parse as a Boolean, and `pending` is declared as one. Use `pending=true` or `pending=false`.")

    assertOffenses(dedent`
      <%# herb:state (pending: false) %>
      <button data-herb-set="pending=maybe">Send</button>
    `)
  })

  test("flags a data-herb-by that is not an integer", () => {
    expectError(`\`data-herb-by="two"\` is not an integer, so the step falls back to 1. Use a whole number, like \`data-herb-by="2"\`.`)

    assertOffenses(dedent`
      <%# herb:state (attempts: 0) %>
      <button data-herb-increment="attempts" data-herb-by="two">More</button>
    `)
  })

  test("resolves an item state from inside its loop", () => {
    expectNoOffenses(dedent`
      <% @rows.each do |row| %>
        <%# herb:state (starred: false) %>
        <button data-herb-toggle="starred">Star</button>
      <% end %>
    `)
  })

  test("flags an item state referenced outside its loop", () => {
    expectError("Nothing in scope here declares the state `starred`. Declare it with `<%# herb:state (starred: ...) %>`, or use one of the states in scope. States in scope: `open`.")

    assertOffenses(dedent`
      <%# herb:state (open: false) %>
      <% @rows.each do |row| %>
        <%# herb:state (starred: false) %>
        <span></span>
      <% end %>
      <button data-herb-toggle="starred">Star</button>
    `)
  })

  test("allows a string state set to anything", () => {
    expectNoOffenses(dedent`
      <%# herb:state (draft: "") %>
      <button data-herb-set="draft=true">Literal word</button>
      <button data-herb-set="draft=">Empty</button>
    `)
  })
  test("flags every action on a derived state", () => {
    expectError("`data-herb-toggle` on `busy` can never work, because `busy` is derived from `pending || failed`. Write the states it reads instead.")
    expectError("`busy=false` can never work, because `busy` is derived from `pending || failed`. Write the states it reads instead.")

    assertOffenses(dedent`
      <%# herb:state (pending: false, failed: false, busy: pending || failed) %>
      <button data-herb-toggle="busy">Toggle</button>
      <button data-herb-set="busy=false">Clear</button>
      <div><% if busy %>B<% end %></div>
    `)
  })

  test("allows actions on a derived state's sources", () => {
    expectNoOffenses(dedent`
      <%# herb:state (pending: false, failed: false, busy: pending || failed) %>
      <button data-herb-toggle="pending">Toggle</button>
      <button data-herb-set="failed=true">Fail</button>
      <div><% if busy %>B<% end %></div>
    `)
  })
  test("flags actions on a counted state", () => {
    expectError("`data-herb-increment` on `total` can never work, because `total` is counted from the template's loop. Write the item states its condition reads instead.")
    expectError("`total=5` can never work, because `total` is counted from the template's loop. Write the item states its condition reads instead.")

    assertOffenses(dedent`
      <%# herb:state (total: 0) %>
      <ul><% @items.each do |item| %><%# herb:state (pending: false) %><% if pending? %><% total += 1 %><% end %><li><%= item %></li><% end %></ul>
      <button data-herb-increment="total">More</button>
      <button data-herb-set="total=5">Set</button>
      <p><%= total %></p>
    `)
  })
  test("validates actions built by a tag helper", () => {
    expectError("`data-herb-toggle` on `attempts` can never work, because `attempts` is an Integer and it needs a Boolean. Set a value instead, like `data-herb-set=\"attempts=...\"`, or declare a boolean flag.")

    assertOffenses(dedent`
      <%# herb:state (attempts: 0) %>
      <%= tag.button "More", data: { herb_toggle: "attempts" } %>
      <p><%= attempts %></p>
    `)
  })
})
