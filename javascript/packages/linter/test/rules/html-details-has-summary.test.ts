import { describe, test } from "vitest"
import { HTMLDetailsHasSummaryRule } from "../../src/rules/html-details-has-summary.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HTMLDetailsHasSummaryRule)

describe("html-details-has-summary", () => {
  test("passes when details has a direct summary child", () => {
    expectNoOffenses('<details><summary>Expand me!</summary><p>Content</p></details>')
  })

  test("passes when summary is not the first child", () => {
    expectNoOffenses('<details><p>Surprise text!</p><summary>Expand me!</summary></details>')
  })

  test("fails when details has no summary", () => {
    expectWarning("`<details>` element must have a direct `<summary>` child element.")

    assertOffenses("<details>I don't have a summary element</details>")
  })

  test("fails when summary is not a direct child of details", () => {
    expectWarning("`<details>` element must have a direct `<summary>` child element.")

    assertOffenses("<details><div><summary>Expand me!</summary></div></details>")
  })

  test("ignores non-details elements", () => {
    expectNoOffenses('<div><p>No summary needed here</p></div>')
  })

  test("handles multiple details elements independently", () => {
    expectWarning("`<details>` element must have a direct `<summary>` child element.")

    assertOffenses('<details><summary>OK</summary></details><details><p>Missing summary</p></details>')
  })

  test("passes for details with summary and other content", () => {
    expectNoOffenses('<details><summary>Expand me!</summary><button>Surprise button!</button></details>')
  })

  test("fails for empty details element", () => {
    expectWarning("`<details>` element must have a direct `<summary>` child element.")

    assertOffenses('<details></details>')
  })

  test("fails when details is rendered with tag.details and no summary", () => {
    expectWarning("`<details>` element must have a direct `<summary>` child element.")

    assertOffenses(`
      <details>
        <%= tag.div "Not a summary" %>
      </details>
    `)
  })

  test("fails when details has content_tag but not a summary", () => {
    expectWarning("`<details>` element must have a direct `<summary>` child element.")

    assertOffenses(`
      <details>
        <%= content_tag(:div) { "Not a summary" } %>
      </details>
    `)
  })

  test("fails when details only contains ERB output", () => {
    expectWarning("`<details>` element must have a direct `<summary>` child element.")

    assertOffenses(`
      <details>
        <%= tag.p "Some content" %>
      </details>
    `)
  })

  test("fails when details only contains content_tag with do block", () => {
    expectWarning("`<details>` element must have a direct `<summary>` child element.")

    assertOffenses(`
      <details>
        <%= content_tag(:div) do %>
          Not a summary
        <% end %>
      </details>
    `)
  })

  test("fails when tag.details has no summary", () => {
    expectWarning("`<details>` element must have a direct `<summary>` child element.")

    assertOffenses(`
      <%= tag.details do %>
        Some content without summary
      <% end %>
    `)
  })

  test("fails when content_tag(:details) has no summary", () => {
    expectWarning("`<details>` element must have a direct `<summary>` child element.")

    assertOffenses(`<%= content_tag(:details) { "Some content" } %>`)
  })

  test("fails when content_tag(:details) with do block has no summary", () => {
    expectWarning("`<details>` element must have a direct `<summary>` child element.")

    assertOffenses(`
      <%= content_tag(:details) do %>
        Some content without summary
      <% end %>
    `)
  })

  test("passes when content_tag(:details) has content_tag(:summary)", () => {
    expectNoOffenses(`
      <%= content_tag(:details) do %>
        <%= content_tag(:summary) { "Expand me!" } %>
        Some content
      <% end %>
    `)
  })

  test("passes when tag.details has a summary child", () => {
    expectNoOffenses(`
      <%= tag.details do %>
        <summary>Expand me!</summary>
        Some content
      <% end %>
    `)
  })

  test("passes when tag.details has tag.summary child", () => {
    expectNoOffenses(`
      <%= tag.details do %>
        <%= tag.summary "Expand me!" %>
        Some content
      <% end %>
    `)
  })
})
