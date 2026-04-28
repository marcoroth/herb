import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { ActionViewNoUnnecessaryTagAttributesRule } from "../../src/rules/actionview-no-unnecessary-tag-attributes.js"

describe("actionview-no-unnecessary-tag-attributes autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("converts void element with tag.attributes to tag helper", () => {
    const input = `<input <%= tag.attributes(type: :text, aria: { label: "Search" }) %>>`
    const expected = `<%= tag.input(type: :text, aria: { label: "Search" }) %>`

    const linter = new Linter(Herb, [ActionViewNoUnnecessaryTagAttributesRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("converts img with tag.attributes to tag helper", () => {
    const input = `<img <%= tag.attributes(src: image_path("logo.png"), alt: "Logo") %>>`
    const expected = `<%= tag.img(src: image_path("logo.png"), alt: "Logo") %>`

    const linter = new Linter(Herb, [ActionViewNoUnnecessaryTagAttributesRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("converts non-void element with tag.attributes to tag helper with do/end", () => {
    const input = dedent`
      <div <%= tag.attributes(id: "container", class: "wrapper") %>>
        Content
      </div>
    `

    const expected = dedent`
      <%= tag.div(id: "container", class: "wrapper") do %>
        Content
      <% end %>
    `

    const linter = new Linter(Herb, [ActionViewNoUnnecessaryTagAttributesRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("converts non-void element with no content to tag helper", () => {
    const input = `<div <%= tag.attributes(id: "container", class: "wrapper") %>></div>`
    const expected = `<%= tag.div(id: "container", class: "wrapper") %>`

    const linter = new Linter(Herb, [ActionViewNoUnnecessaryTagAttributesRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("converts non-void element with whitespace-only content to tag helper with do/end", () => {
    const input = `<div <%= tag.attributes(id: "container", class: "wrapper") %>>   </div>`
    const expected = `<%= tag.div(id: "container", class: "wrapper") do %>   <% end %>`

    const linter = new Linter(Herb, [ActionViewNoUnnecessaryTagAttributesRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("converts void element with single attribute to tag helper", () => {
    const input = `<br <%= tag.attributes(class: "spacer") %>>`
    const expected = `<%= tag.br(class: "spacer") %>`

    const linter = new Linter(Herb, [ActionViewNoUnnecessaryTagAttributesRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not autofix when tag.attributes is mixed with HTML attributes", () => {
    const input = `<button class="primary" <%= tag.attributes(id: "cta") %>>Click</button>`

    const linter = new Linter(Herb, [ActionViewNoUnnecessaryTagAttributesRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })
})
