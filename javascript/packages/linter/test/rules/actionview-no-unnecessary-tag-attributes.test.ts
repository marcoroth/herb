import dedent from "dedent"

import { describe, test } from "vitest"

import { ActionViewNoUnnecessaryTagAttributesRule } from "../../src/rules/actionview-no-unnecessary-tag-attributes.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(ActionViewNoUnnecessaryTagAttributesRule)

describe("ActionViewNoUnnecessaryTagAttributesRule", () => {
  test("regular HTML input with attributes is allowed", () => {
    expectNoOffenses(dedent`
      <input type="text" aria-label="Search">
    `)
  })

  test("tag helper for input is allowed", () => {
    expectNoOffenses(dedent`
      <%= tag.input type: :text, aria: { label: "Search" } %>
    `)
  })

  test("regular HTML div with attributes is allowed", () => {
    expectNoOffenses(dedent`
      <div id="container" class="wrapper">
        Content
      </div>
    `)
  })

  test("tag helper for div is allowed", () => {
    expectNoOffenses(dedent`
      <%= tag.div id: "container", class: "wrapper" do %>
        Content
      <% end %>
    `)
  })

  test("regular HTML img with attributes is allowed", () => {
    expectNoOffenses(dedent`
      <img src="logo.png" alt="Logo">
    `)
  })

  test("tag helper for img is allowed", () => {
    expectNoOffenses(dedent`
      <%= tag.img src: "logo.png", alt: "Logo" %>
    `)
  })

  test("element with no attributes is allowed", () => {
    expectNoOffenses(dedent`
      <div>Content</div>
    `)
  })

  test("mixed HTML and tag.attributes attributes is allowed", () => {
    expectNoOffenses(dedent`
      <button class="primary" <%= tag.attributes(id: "call-to-action", disabled: false, aria: { expanded: false }) %>>Get Started!</button>
    `)
  })

  test("HTML attribute before tag.attributes is allowed", () => {
    expectNoOffenses(dedent`
      <button class="primary" <%= tag.attributes(id: "call-to-action", disabled: false, aria: { expanded: false }) %>>Get Started!</button>
    `)
  })

  test("HTML attribute after tag.attributes is allowed", () => {
    expectNoOffenses(dedent`
      <button <%= tag.attributes(id: "call-to-action", disabled: false, aria: { expanded: false }) %> class="primary">Get Started!</button>
    `)
  })

  test("input with only tag.attributes is not allowed", () => {
    expectWarning("Avoid using `tag.attributes` to set all attributes on `<input>`. Use `tag.input` or add the attributes directly to the `<input>` tag instead.")

    assertOffenses(dedent`
      <input <%= tag.attributes(type: :text, aria: { label: "Search" }) %>>
    `)
  })

  test("div with only tag.attributes is not allowed", () => {
    expectWarning("Avoid using `tag.attributes` to set all attributes on `<div>`. Use `tag.div` or add the attributes directly to the `<div>` tag instead.")

    assertOffenses(dedent`
      <div <%= tag.attributes(id: "container", class: "wrapper") %>>
        Content
      </div>
    `)
  })

  test("img with only tag.attributes is not allowed", () => {
    expectWarning("Avoid using `tag.attributes` to set all attributes on `<img>`. Use `tag.img` or add the attributes directly to the `<img>` tag instead.")

    assertOffenses(dedent`
      <img <%= tag.attributes(src: "logo.png", alt: "Logo") %>>
    `)
  })
})
