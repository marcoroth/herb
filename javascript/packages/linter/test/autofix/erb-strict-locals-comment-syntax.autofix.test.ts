import { describe, test, expect, beforeAll } from "vitest"
import dedent from "dedent"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { ERBStrictLocalsCommentSyntaxRule } from "../../src/rules/erb-strict-locals-comment-syntax.js"

describe("erb-strict-locals-comment-syntax autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  const autofix = (input: string) => {
    const linter = new Linter(Herb, [ERBStrictLocalsCommentSyntaxRule])

    return linter.autofix(input, { fileName: "_partial.html.erb", framework: "actionview" })
  }

  const expectFix = (input: string, expected: string, count: number = 1) => {
    const result = autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(count)
    expect(result.unfixed).toHaveLength(0)
  }

  const expectNoFix = (input: string) => {
    const result = autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
  }

  test("adds the missing colon after locals", () => {
    expectFix(`<%# locals() %>`, `<%# locals: () %>`)
    expectFix(`<%# locals(user:) %>`, `<%# locals: (user:) %>`)
  })

  test("pluralizes local:", () => {
    expectFix(`<%# local: (user:) %>`, `<%# locals: (user:) %>`)
  })

  test("adds the missing colon before the parentheses", () => {
    expectFix(`<%# locals (user:) %>`, `<%# locals: (user:) %>`)
  })

  test("adds the missing space after the colon", () => {
    expectFix(`<%# locals:() %>`, `<%# locals: () %>`)
    expectFix(`<%# locals:(user:, admin: false) %>`, `<%# locals: (user:, admin: false) %>`)
  })

  test("switches the Ruby comment to an ERB comment", () => {
    expectFix(`<% # locals: (user:) %>`, `<%# locals: (user:) %>`)
    expectFix(`<%- # locals: (user:) %>`, `<%# locals: (user:) %>`)
  })

  test("wraps parameters in parentheses", () => {
    expectFix(`<%# locals: user:, admin: false %>`, `<%# locals: (user:, admin: false) %>`)
  })

  test("wraps parameters in parentheses and turns bare names into keyword arguments", () => {
    expectFix(`<%# locals: user %>`, `<%# locals: (user:) %>`)
  })

  test("adds parentheses to an empty declaration", () => {
    expectFix(`<%# locals: %>`, `<%# locals: () %>`)
  })

  test("closes unbalanced parentheses", () => {
    expectFix(`<%# locals: (user: %>`, `<%# locals: (user:) %>`)
  })

  test("turns positional arguments into keyword arguments", () => {
    expectFix(`<%# locals: (user) %>`, `<%# locals: (user:) %>`)
    expectFix(`<%# locals: (user, admin) %>`, `<%# locals: (user:, admin:) %>`, 2)
    expectFix(`<%# locals: (user, admin: false) %>`, `<%# locals: (user:, admin: false) %>`)
  })

  test("removes a trailing comma", () => {
    expectFix(`<%# locals: (user:,) %>`, `<%# locals: (user:) %>`)
  })

  test("removes a leading comma", () => {
    expectFix(`<%# locals: (, user:) %>`, `<%# locals: (user:) %>`)
  })

  test("removes a double comma", () => {
    expectFix(`<%# locals: (user:,, admin:) %>`, `<%# locals: (user:, admin:) %>`)
  })

  test("combines the missing space and the missing parentheses", () => {
    expectFix(`<%# locals:user %>`, `<%# locals: (user:) %>`, 2)
  })

  test("keeps the surrounding template intact", () => {
    expectFix(dedent`
      <%# locals: (user) %>

      <p><%= user.name %></p>
    `, dedent`
      <%# locals: (user:) %>

      <p><%= user.name %></p>
    `)
  })

  test("does not fix block arguments", () => {
    expectNoFix(`<%# locals: (&block) %>`)
  })

  test("does not fix splat arguments", () => {
    expectNoFix(`<%# locals: (*args) %>`)
  })

  test("does not fix duplicate declarations", () => {
    expectNoFix(dedent`
      <%# locals: (user:) %>

      <%# locals: (admin:) %>
    `)
  })
})
