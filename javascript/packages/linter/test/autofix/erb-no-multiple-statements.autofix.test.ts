import { describe, test, expect, beforeAll } from "vitest"
import dedent from "dedent"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { fixabilityFor } from "../../src/fixability.js"
import { ERBNoMultipleStatementsRule } from "../../src/rules/erb-no-multiple-statements.js"

const linter = () => new Linter(Herb, [ERBNoMultipleStatementsRule])

const fixabilityOf = (source: string) => {
  const [offense] = linter().lint(source).offenses

  return fixabilityFor(offense, ERBNoMultipleStatementsRule as any)
}

describe("erb-no-multiple-statements autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("splits a tag that stands alone on its line across lines", () => {
    const input = dedent`
      <div>
        <% user = User.find(1); post = user.posts.first %>
      </div>
    `

    const expected = dedent`
      <div>
        <% user = User.find(1) %>
        <% post = user.posts.first %>
      </div>
    `

    const result = linter().autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("splits a tag that shares its line with markup in place", () => {
    const input = '<div><% a = 1; b = 2 %><%= a + b %></div>'
    const expected = '<div><% a = 1 %><% b = 2 %><%= a + b %></div>'

    const result = linter().autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("keeps the output opening on the last statement", () => {
    const input = '<div><%= user = User.find(1); user.name %></div>'
    const expected = '<div><% user = User.find(1) %><%= user.name %></div>'

    expect(linter().autofix(input).source).toBe(expected)
  })

  test("keeps a raw output opening on the last statement", () => {
    const input = '<div><%== r = markup; r %></div>'
    const expected = '<div><% r = markup %><%== r %></div>'

    expect(linter().autofix(input).source).toBe(expected)
  })

  test("keeps the leading trim on the first statement and the trailing trim on the last", () => {
    const input = dedent`
      <div>
        <%- a = 1; b = 2 -%>
      </div>
    `

    const expected = dedent`
      <div>
        <%- a = 1 %>
        <% b = 2 -%>
      </div>
    `

    expect(linter().autofix(input).source).toBe(expected)
  })

  test("splits every statement when there are more than two", () => {
    const input = dedent`
      <div>
        <% a = 1; b = 2; c = 3 %>
      </div>
    `

    const expected = dedent`
      <div>
        <% a = 1 %>
        <% b = 2 %>
        <% c = 3 %>
      </div>
    `

    expect(linter().autofix(input).source).toBe(expected)
  })

  test("keeps the indentation of the tag it splits", () => {
    const input = dedent`
      <% posts.each do |post| %>
        <% title = post.title; author = post.author %>
      <% end %>
    `

    const expected = dedent`
      <% posts.each do |post| %>
        <% title = post.title %>
        <% author = post.author %>
      <% end %>
    `

    expect(linter().autofix(input).source).toBe(expected)
  })

  test("splits on statement boundaries, not on every semicolon", () => {
    const input = '<div><% x = "; b = 2"; b = 2 %><%= x %></div>'
    const expected = '<div><% x = "; b = 2" %><% b = 2 %><%= x %></div>'

    expect(linter().autofix(input).source).toBe(expected)
  })

  test("moves a statement holding a block across verbatim", () => {
    const input = '<div><% total = 0; [1, 2].each { |number| total += number } %><%= total %></div>'
    const expected = '<div><% total = 0 %><% [1, 2].each { |number| total += number } %><%= total %></div>'

    expect(linter().autofix(input).source).toBe(expected)
  })

  test("leaves the source alone when nothing is fixable", () => {
    const input = '<% def helper; end; a = 1 %>'

    const result = linter().autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(1)
  })

  test("reports every offense on the tag as fixed, since the tag is split as a whole", () => {
    const input = dedent`
      <div>
        <% a = 1; b = 2; c = 3 %>
      </div>
    `

    const result = linter().autofix(input)

    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("splits the whole tag when only one of its offenses is fixed", () => {
    const input = dedent`
      <div>
        <% a = 1; b = 2; c = 3 %>
      </div>
    `

    const expected = dedent`
      <div>
        <% a = 1 %>
        <% b = 2 %>
        <% c = 3 %>
      </div>
    `

    const offenses = linter().lint(input).offenses

    for (const offense of offenses) {
      expect(linter().autofix(input, undefined, [offense]).source).toBe(expected)
    }
  })

  describe("fixability", () => {
    test("is safe for statements that stand on their own", () => {
      expect(fixabilityOf('<div><% a = 1; b = 2 %></div>')).toEqual({ autocorrectable: true, unsafeAutocorrectable: false })
    })

    test("is unsafe inside an element that preserves whitespace", () => {
      expect(fixabilityOf('<pre><% a = 1; b = 2 %></pre>')).toEqual({ autocorrectable: false, unsafeAutocorrectable: true })
    })

    test("is safe for a statement holding a block, which moves across verbatim", () => {
      expect(fixabilityOf('<div><% a = 1; [1].each { |number| puts number } %></div>')).toEqual({ autocorrectable: true, unsafeAutocorrectable: false })
    })

    test("is safe for a statement holding a conditional", () => {
      expect(fixabilityOf('<div><% a = 1; if b then c = 2 end %></div>')).toEqual({ autocorrectable: true, unsafeAutocorrectable: false })
    })

    test("is not offered for a method definition", () => {
      expect(fixabilityOf('<% def helper; end; a = 1 %>')).toEqual({ autocorrectable: false, unsafeAutocorrectable: false })
    })

    test("is not offered for a class definition", () => {
      expect(fixabilityOf('<% class Helper; end; a = 1 %>')).toEqual({ autocorrectable: false, unsafeAutocorrectable: false })
    })

    test("is not offered for a method alias", () => {
      expect(fixabilityOf('<% alias helper other; a = 1 %>')).toEqual({ autocorrectable: false, unsafeAutocorrectable: false })
    })

    test("is not offered for an undefined method", () => {
      expect(fixabilityOf('<% undef helper; a = 1 %>')).toEqual({ autocorrectable: false, unsafeAutocorrectable: false })
    })

    test("is not offered when a comment trails the statements", () => {
      expect(fixabilityOf('<% a = 1; b = 2 # note %>')).toEqual({ autocorrectable: false, unsafeAutocorrectable: false })
    })

    test("is offered when only a semicolon trails the statements", () => {
      expect(fixabilityOf('<div><% a = 1; b = 2; %></div>')).toEqual({ autocorrectable: true, unsafeAutocorrectable: false })
    })
  })
})
