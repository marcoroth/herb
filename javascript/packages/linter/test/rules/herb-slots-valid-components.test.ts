import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbSlotsValidComponentsRule } from "../../src/rules/herb-slots-valid-components.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, expectWarning, assertOffenses } = createLinterTest(HerbSlotsValidComponentsRule)

describe("herb-slots-valid-components", () => {
  test("passes for a fragment with one fallback", () => {
    expectNoOffenses(dedent`
      <%# herb:slots client %>
      <Fragment delay="0" hold="600" on="album">
        <p><%= @value %></p>
        <Fallback><p>waiting</p></Fallback>
      </Fragment>
    `)
  })

  test("passes for a deferred block with poll and no fallback", () => {
    expectNoOffenses(dedent`
      <%# herb:slots client %>
      <Async poll="5000">
        <p><%= @stats %></p>
      </Async>
    `)
  })

  test("says nothing in a template without a slots directive", () => {
    expectNoOffenses(dedent`
      <Fragment><p>x</p></Fragment>
    `)
  })

  test("warns for a fragment without a fallback", () => {
    expectWarning("`<Fragment>` holds no `<Fallback>`, so it wraps nothing and compiles away.")

    assertOffenses(dedent`
      <%# herb:slots client %>
      <Fragment>
        <p><%= @value %></p>
      </Fragment>
    `)
  })

  test("flags a fallback outside a fragment", () => {
    expectError("`<Fallback>` sits outside a `<Fragment>`, so there is nothing for it to stand in for.")

    assertOffenses(dedent`
      <%# herb:slots client %>
      <Fallback><p>alone</p></Fallback>
    `)
  })

  test("flags two fallbacks in one component, naming it", () => {
    expectError("A `<Lazy>` holds 2 `<Fallback>` elements, and it can only stand one in.")

    assertOffenses(dedent`
      <%# herb:slots client %>
      <Lazy>
        <p><%= @a %></p>
        <Fallback><p>one</p></Fallback>
        <Fallback><p>two</p></Fallback>
      </Lazy>
    `)
  })

  test("flags a component name Herb does not know", () => {
    expectError("`<Skeleton>` is not a component Herb knows.")

    assertOffenses(dedent`
      <%# herb:slots client %>
      <Skeleton><p>x</p></Skeleton>
    `)
  })

  test("flags an unknown attribute, listing what the component takes", () => {
    expectError("`<Fragment>` only takes `delay` and `hold` and `on`.")
    expectError("`<Async>` only takes `delay` and `hold` and `on` and `poll`.")

    assertOffenses(dedent`
      <%# herb:slots client %>
      <Fragment id="x">
        <p><%= @a %></p>
        <Fallback><p>f</p></Fallback>
      </Fragment>
      <Async id="y">
        <p><%= @b %></p>
      </Async>
    `)
  })

  test("flags attributes on a fallback", () => {
    expectError("`<Fallback>` takes no attributes yet.")

    assertOffenses(dedent`
      <%# herb:slots client %>
      <Fragment>
        <p><%= @a %></p>
        <Fallback delay="150"><p>f</p></Fallback>
      </Fragment>
    `)
  })

  test("flags a timing attribute that is not a whole number", () => {
    expectError("`delay` on a `<Fragment>` takes a whole number of milliseconds.")

    assertOffenses(dedent`
      <%# herb:slots client %>
      <Fragment delay="fast">
        <p><%= @a %></p>
        <Fallback><p>f</p></Fallback>
      </Fragment>
    `)
  })

  test("flags an empty on attribute", () => {
    expectError("`on` names the states that mask this `<Fragment>`, and it names none.")

    assertOffenses(dedent`
      <%# herb:slots client %>
      <Fragment on="">
        <p><%= @a %></p>
        <Fallback><p>f</p></Fallback>
      </Fragment>
    `)
  })

  test("flags a fragment nested inside a fallback", () => {
    expectError("A `<Fragment>` sits inside a `<Fallback>`, which renders once and stays static, so nothing inside it can stay live.")
    expectWarning("`<Fragment>` holds no `<Fallback>`, so it wraps nothing and compiles away.")

    assertOffenses(dedent`
      <%# herb:slots client %>
      <Fragment>
        <p><%= @a %></p>
        <Fallback>
          <Fragment><p><%= @b %></p></Fragment>
        </Fallback>
      </Fragment>
    `)
  })

  test("flags a deferred block inside a collection", () => {
    expectError("A `<Async>` sits inside a collection, and a deferred block cannot stand per item yet.")

    assertOffenses(dedent`
      <%# herb:slots client %>
      <ul>
        <% @tiles.each do |tile| %>
          <li>
            <Async>
              <p><%= Metrics.load(tile) %></p>
              <Fallback><p>tile loading</p></Fallback>
            </Async>
          </li>
        <% end %>
      </ul>
    `)
  })

  test("flags a fallback under a plain element inside a fragment, like the engine", () => {
    expectError("`<Fallback>` sits outside a `<Fragment>`, so there is nothing for it to stand in for.")
    expectWarning("`<Fragment>` holds no `<Fallback>`, so it wraps nothing and compiles away.")

    assertOffenses(dedent`
      <%# herb:slots client %>
      <Fragment>
        <p><%= @a %></p>
        <div><Fallback><p>f</p></Fallback></div>
      </Fragment>
    `)
  })

  test("passes for a deferred block wrapping a collection", () => {
    expectNoOffenses(dedent`
      <%# herb:slots client %>
      <Lazy>
        <ul>
          <% @tiles.each do |tile| %>
            <li><%= tile %></li>
          <% end %>
        </ul>
        <Fallback><p>tiles loading</p></Fallback>
      </Lazy>
    `)
  })
})
