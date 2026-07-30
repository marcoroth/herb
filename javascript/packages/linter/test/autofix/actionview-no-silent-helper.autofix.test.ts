import dedent from "dedent"

import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { createAutofixTest } from "../helpers/autofix-test-helper.js"

import { ActionViewNoSilentHelperRule } from "../../src/rules/actionview-no-silent-helper.js"

describe("actionview-no-silent-helper autofix", () => {
  const { unsafeAutofix } = createAutofixTest(ActionViewNoSilentHelperRule)

  beforeAll(async () => {
    await Herb.load()
  })

  test.skip("output tag is not modified", () => {
    const input = dedent`
      <%= link_to "Home", root_path %>
    `

    const result = unsafeAutofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test.skip("fixes silent tag to output tag for link_to", () => {
    const input = dedent`
      <% link_to "Home", root_path %>
    `

    const expected = dedent`
      <%= link_to "Home", root_path %>
    `

    const result = unsafeAutofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test.skip("fixes silent tag to output tag for content_tag", () => {
    const input = dedent`
      <% content_tag :div, "Hello", class: "greeting" %>
    `

    const expected = dedent`
      <%= content_tag :div, "Hello", class: "greeting" %>
    `

    const result = unsafeAutofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test.skip("fixes trimmed silent tag to output tag", () => {
    const input = dedent`
      <%- link_to "Home", root_path %>
    `

    const expected = dedent`
      <%= link_to "Home", root_path %>
    `

    const result = unsafeAutofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test.skip("fixes silent tag for turbo_frame_tag", () => {
    const input = dedent`
      <% turbo_frame_tag "test" %>
    `

    const expected = dedent`
      <%= turbo_frame_tag "test" %>
    `

    const result = unsafeAutofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })
})
