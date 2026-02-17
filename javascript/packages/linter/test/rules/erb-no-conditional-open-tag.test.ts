import { describe, it } from "vitest"
import dedent from "dedent";

import { ERBNoConditionalOpenTagRule } from "../../src/rules/erb-no-conditional-open-tag.js";
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoConditionalOpenTagRule)

const errorMessage = (tagName: string) =>
  `Avoid using ERB conditionals to split the open and closing tag of \`<${tagName}>\` element.`

describe("erb-no-conditional-open-tag", () => {
  it("allows conditional attributes directly", () => {
    const html = dedent`
      <div class="<%= @condition ? 'a' : 'b' %>">
        Content
      </div>
    `

    expectNoOffenses(html)
  })

  it("allows content_tag with conditional options", () => {
    const html = dedent`
      <%= content_tag :div, class: (@condition ? 'a' : 'b') do %>
        Content
      <% end %>
    `

    expectNoOffenses(html)
  })

  it("allows class_names helper", () => {
    const html = dedent`
      <div class="<%= class_names('base', 'a': @condition, 'b': !@condition) %>">
        Content
      </div>
    `

    expectNoOffenses(html)
  })

  it("allows complete separate elements in each branch", () => {
    const html = dedent`
      <% if @condition %>
        <div class="a" data-foo="bar">Content</div>
      <% else %>
        <div class="b" data-baz="qux">Content</div>
      <% end %>
    `

    expectNoOffenses(html)
  })

  it("allows void elements in conditionals", () => {
    const html = dedent`
      <% if @large %>
        <img src="photo.jpg" width="800" height="600">
      <% else %>
        <img src="photo.jpg" width="400" height="300">
      <% end %>
    `

    expectNoOffenses(html)
  })

  it("allows normal if statements wrapping complete elements", () => {
    const html = dedent`
      <% if true %>
        <div>Text</div>
      <% end %>
    `

    expectNoOffenses(html)
  })

  it("allows regular HTML elements", () => {
    const html = dedent`
      <div class="container">
        <p>Content</p>
      </div>
    `

    expectNoOffenses(html)
  })

  it("reports conditional open tag with if/else varying class", () => {
    const html = dedent`
      <% if @condition %>
        <div class="a">
      <% else %>
        <div class="b">
      <% end %>
        Content
      </div>
    `

    expectError(errorMessage("div"))
    assertOffenses(html)
  })

  it("reports conditional open tag with button", () => {
    const html = dedent`
      <% if @with_icon %>
        <button class="btn btn-icon" aria-label="Action">
      <% else %>
        <button class="btn">
      <% end %>
        Click me
      </button>
    `

    expectError(errorMessage("button"))
    assertOffenses(html)
  })

  it("reports conditional open tag with if/elsif/else", () => {
    const html = dedent`
      <% if @style == "a" %>
        <div class="a">
      <% elsif @style == "b" %>
        <div class="b">
      <% else %>
        <div class="c">
      <% end %>
        Content
      </div>
    `

    expectError(errorMessage("div"))
    assertOffenses(html)
  })

  it("reports conditional open tag with unless", () => {
    const html = dedent`
      <% unless @plain %>
        <div class="fancy">
      <% else %>
        <div class="plain">
      <% end %>
        Content
      </div>
    `

    expectError(errorMessage("div"))
    assertOffenses(html)
  })

  it("reports multiple conditional open tags", () => {
    const html = dedent`
      <% if @first %>
        <div class="a">
      <% else %>
        <div class="b">
      <% end %>
        Content
      </div>
      <% if @second %>
        <span class="x">
      <% else %>
        <span class="y">
      <% end %>
        More content
      </span>
    `

    expectError(errorMessage("div"))
    expectError(errorMessage("span"))
    assertOffenses(html)
  })
})
