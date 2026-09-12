import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbComponentRequiresSlotsRule } from "../../src/rules/herb-component-requires-slots.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HerbComponentRequiresSlotsRule)

const message = (name: string) => `\`<${name}>\` is written like a component, but this template never opts into slots, so the browser renders it as a literal unknown element. Add \`<%# herb:slots client %>\` to compile it, or lowercase the tag if it is meant as plain HTML.`

describe("herb-component-requires-slots", () => {
  test("passes for components in a client slots template", () => {
    expectNoOffenses(dedent`
      <%# herb:slots client %>
      <Fragment>
        <p><%= @value %></p>
        <Fallback><p>waiting</p></Fallback>
      </Fragment>
    `)
  })

  test("passes for components in a server slots template", () => {
    expectNoOffenses(dedent`
      <%# herb:slots server %>
      <Fragment>
        <p><%= @value %></p>
        <Fallback><p>waiting</p></Fallback>
      </Fragment>
    `)
  })

  test("passes for plain HTML and custom elements without the directive", () => {
    expectNoOffenses(dedent`
      <div class="card"><my-widget></my-widget></div>
    `)
  })

  test("passes for an XML document, where uppercase tags are ordinary", () => {
    expectNoOffenses(dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <OpenSearchDescription>
        <ShortName><%= @name %></ShortName>
      </OpenSearchDescription>
    `)
  })

  test("flags each component tag in a template without the directive", () => {
    expectError(message("Fragment"))
    expectError(message("Fallback"))

    assertOffenses(dedent`
      <Fragment>
        <p><%= @value %></p>
        <Fallback><p>waiting</p></Fallback>
      </Fragment>
    `)
  })

  test("flags a component name Herb does not know, since nothing compiles it either", () => {
    expectError(message("MyWidget"))

    assertOffenses(dedent`
      <MyWidget></MyWidget>
    `)
  })
})
