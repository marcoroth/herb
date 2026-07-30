import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { createAutofixTest } from "../helpers/autofix-test-helper.js"
import { ActionViewStrictLocalsPartialOnlyRule } from "../../src/rules/actionview-strict-locals-partial-only.js"

describe("actionview-strict-locals-partial-only autofix", () => {
  const { unsafeAutofix } = createAutofixTest(ActionViewStrictLocalsPartialOnlyRule)

  beforeAll(async () => {
    await Herb.load()
  })

  test("removes strict locals declaration from non-partial file", () => {
    const input = dedent`
      <%# locals: (user:) %>

      <div><%= user.name %></div>
    `
    const expected = `<div><%= user.name %></div>`

    const result = unsafeAutofix(input, { fileName: "show.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not autofix without includeUnsafe", () => {
    const input = dedent`
      <%# locals: (user:) %>

      <div><%= user.name %></div>
    `

    const result = autofix(input, { fileName: "show.html.erb" })

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(1)
  })

  test("does not modify partial files", () => {
    const input = dedent`
      <%# locals: (user:) %>

      <div><%= user.name %></div>
    `

    const result = unsafeAutofix(input, { fileName: "_partial.html.erb" })

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("removes strict locals and trailing whitespace from layout file", () => {
    const input = dedent`
      <%# locals: (title:) %>

      <html>
        <head><title><%= title %></title></head>
      </html>
    `
    const expected = dedent`
      <html>
        <head><title><%= title %></title></head>
      </html>
    `

    const result = unsafeAutofix(input, { fileName: "application.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })
})
