import { describe, it, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src/formatter"
import dedent from "dedent"

describe("conditional attributes", () => {
  let formatter: Formatter

  beforeAll(async () => {
    await Herb.load()
    formatter = new Formatter(Herb)
  })

  it("should preserve conditional ERB in class attributes with string interpolation", () => {
    const source = dedent`
      <%= form.label "file_#{id}", class: "btn #{"disabled" if disabled} flex-grow", style: "font-size: 0.875rem;" do %>
        Upload
      <% end %>
    `

    const expected = dedent`
      <%= form.label "file_#{id}", class: "btn #{"disabled" if disabled} flex-grow", style: "font-size: 0.875rem;" do %>
        Upload
      <% end %>
    `

    expect(formatter.format(source)).toBe(expected)
  })

  it("should preserve conditional ERB in class attributes", () => {
    const source = dedent`
      <button class="btn <%= "active" if is_active %> primary">Click me</button>
    `

    const expected = dedent`
      <button class="btn <%= "active" if is_active %> primary">
        Click me
      </button>
    `

    expect(formatter.format(source)).toBe(expected)
  })

  it("should preserve conditional ERB with local_assigns", () => {
    const source = dedent`
      <%= link_to path, class: "btn #{"disabled" if local_assigns[:disabled]} bg-primary", data: { behavior: "modal" } do %>
        Select
      <% end %>
    `

    const expected = dedent`
      <%= link_to path, class: "btn #{"disabled" if local_assigns[:disabled]} bg-primary", data: { behavior: "modal" } do %>
        Select
      <% end %>
    `

    expect(formatter.format(source)).toBe(expected)
  })

  it("should preserve inline conditional ERB in div class", () => {
    const source = dedent`
      <div class="container #{"hidden" if should_hide} flex">
        Content here
      </div>
    `

    const expected = dedent`
      <div class="container #{"hidden" if should_hide} flex">
        Content here
      </div>
    `

    expect(formatter.format(source)).toBe(expected)
  })

  it("should preserve conditional ERB blocks wrapping attributes", () => {
    const source = dedent`
      <dialog
        class="relative z-30"
        aria-describedby="<%= stimulus_identifier %>-body"
        <% if title %>
        aria-labelledby="<%= stimulus_identifier %>-title"
        <% end %>
        aria-modal="true"
        data-controller="<%= stimulus_identifier %>"
      >
        test
      </dialog>
    `

    const expected = dedent`
      <dialog
        class="relative z-30"
        aria-describedby="<%= stimulus_identifier %>-body"
        <% if title %>
          aria-labelledby="<%= stimulus_identifier %>-title"
        <% end %>
        aria-modal="true"
        data-controller="<%= stimulus_identifier %>"
      >
        test
      </dialog>
    `

    expect(formatter.format(source)).toBe(expected)
  })
})
