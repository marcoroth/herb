import dedent from "dedent"

import { describe, test } from "vitest"

import { ActionViewNoVoidElementContentRule } from "../../src/rules/actionview-no-void-element-content.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ActionViewNoVoidElementContentRule)

describe("ActionViewNoVoidElementContentRule", () => {
  test("tag.img with src attribute is allowed", () => {
    expectNoOffenses(dedent`
      <%= tag.img src: "/image.png", alt: "Photo" %>
    `)
  })

  test("tag.br without content is allowed", () => {
    expectNoOffenses(dedent`
      <%= tag.br %>
    `)
  })

  test("tag.hr with attributes is allowed", () => {
    expectNoOffenses(dedent`
      <%= tag.hr class: "divider" %>
    `)
  })

  test("content_tag :img without content is allowed", () => {
    expectNoOffenses(dedent`
      <%= content_tag :img, src: "/image.png" %>
    `)
  })

  test("tag.div with content is allowed (non-void element)", () => {
    expectNoOffenses(dedent`
      <%= tag.div "Hello" %>
    `)
  })

  test("content_tag :div with content is allowed (non-void element)", () => {
    expectNoOffenses(dedent`
      <%= content_tag :div, "Hello" %>
    `)
  })

  test("regular HTML void elements are allowed", () => {
    expectNoOffenses(dedent`
      <img src="/image.png" alt="Photo">
      <br>
      <hr>
    `)
  })

  test("tag.img with content argument is not allowed", () => {
    expectError(`Void element \`img\` cannot have content. \`tag.img\` does not accept a positional argument for content.`)

    assertOffenses(dedent`
      <%= tag.img "/image.png" %>
    `)
  })

  test("tag.img with content argument and data attributes is not allowed", () => {
    expectError(`Void element \`img\` cannot have content. \`tag.img\` does not accept a positional argument for content.`)

    assertOffenses(dedent`
      <%= tag.img "/image.png", data: { controller: "image" } %>
    `)
  })

  test("tag.br with content argument is not allowed", () => {
    expectError(`Void element \`br\` cannot have content. \`tag.br\` does not accept a positional argument for content.`)

    assertOffenses(dedent`
      <%= tag.br "hello" %>
    `)
  })

  test("content_tag :img with content argument is not allowed", () => {
    expectError(`Void element \`img\` cannot have content. \`content_tag :img\` does not accept a positional argument for content.`)

    assertOffenses(dedent`
      <%= content_tag :img, "hello" %>
    `)
  })

  test("content_tag :br with content argument is not allowed", () => {
    expectError(`Void element \`br\` cannot have content. \`content_tag :br\` does not accept a positional argument for content.`)

    assertOffenses(dedent`
      <%= content_tag :br, "hello" %>
    `)
  })

  test("tag.img with do...end block is not allowed", () => {
    expectError(`Void element \`img\` cannot have content. \`tag.img\` does not accept a block for content.`)

    assertOffenses(dedent`
      <%= tag.img alt: "hello" do %>
        a
      <% end %>
    `)
  })

  test("tag.br with inline block is not allowed", () => {
    expectError(`Void element \`br\` cannot have content. \`tag.br\` does not accept a block for content.`)

    assertOffenses(dedent`
      <%= tag.br { "content" } %>
    `)
  })

  test("tag.input with do...end block is not allowed", () => {
    expectError(`Void element \`input\` cannot have content. \`tag.input\` does not accept a block for content.`)

    assertOffenses(dedent`
      <%= tag.input do %>
        content
      <% end %>
    `)
  })

  test("content_tag :input with do...end block is not allowed", () => {
    expectError(`Void element \`input\` cannot have content. \`content_tag :input\` does not accept a block for content.`)

    assertOffenses(dedent`
      <%= content_tag :input do %>
        content
      <% end %>
    `)
  })

  test("tag.div with do...end block is allowed (non-void element)", () => {
    expectNoOffenses(dedent`
      <%= tag.div do %>
        content
      <% end %>
    `)
  })

  test("tag.span with inline block is allowed (non-void element)", () => {
    expectNoOffenses(dedent`
      <%= tag.span { "content" } %>
    `)
  })
})
