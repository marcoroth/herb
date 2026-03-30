import dedent from "dedent"
import { describe, test } from "vitest"

import { HTMLNoEventHandlersRule } from "../../src/rules/html-no-event-handlers.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HTMLNoEventHandlersRule)

describe("html-no-event-handlers", () => {
  test("passes with regular element attributes", () => {
    expectNoOffenses(dedent`
      <button class="btn" id="submit" type="submit">Click</button>
    `)
  })

  test("passes with data attributes", () => {
    expectNoOffenses(dedent`
      <div data-controller="hello" data-action="click->hello#greet">Content</div>
    `)
  })

  test("fails with disallowed event handler attribute", () => {
    expectWarning("Avoid inline event handler `onclick`. Use external JavaScript with `addEventListener` instead or an external library like Stimulus.")

    assertOffenses(dedent`
      <button onclick="doSomething()">Click</button>
    `)
  })

  test("fails with ERB output in event handler attribute", () => {
    expectWarning("Avoid inline event handler `onclick`. Use external JavaScript with `addEventListener` instead or an external library like Stimulus.")

    assertOffenses(dedent`
      <a onclick="<%= action %>">Link</a>
    `)
  })

  test("fails with onload event handler", () => {
    expectWarning("Avoid inline event handler `onload`. Use external JavaScript with `addEventListener` instead or an external library like Stimulus.")

    assertOffenses(dedent`
      <body onload="init()"></body>
    `)
  })

  test("fails with onsubmit event handler", () => {
    expectWarning("Avoid inline event handler `onsubmit`. Use external JavaScript with `addEventListener` instead or an external library like Stimulus.")

    assertOffenses(dedent`
      <form onsubmit="validate()"></form>
    `)
  })

  describe("ActionView tag helpers", () => {
    test("passes with tag helper without event handlers", () => {
      expectNoOffenses(dedent`
        <%= tag.button "Submit", class: "btn" %>
      `)
    })

    test("fails with tag helper with onclick", () => {
      expectWarning("Avoid inline event handler `onclick`. Use external JavaScript with `addEventListener` instead or an external library like Stimulus.")

      assertOffenses(dedent`
        <%= tag.button "Submit", onclick: "doSomething()" %>
      `)
    })
  })
})
