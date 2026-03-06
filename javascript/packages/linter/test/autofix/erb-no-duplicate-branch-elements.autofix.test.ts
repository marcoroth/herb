import { describe, test, expect, beforeAll } from "vitest"
import dedent from "dedent"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { ERBNoDuplicateBranchElementsRule } from "../../src/rules/erb-no-duplicate-branch-elements.js"

describe("erb-no-duplicate-branch-elements autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  function autofix(input: string) {
    const linter = new Linter(Herb, [ERBNoDuplicateBranchElementsRule])
    return linter.autofix(input)
  }

  describe("wrapping element (bodies differ)", () => {
    test("basic if/else with same wrapping div", () => {
      const input = dedent`
        <% if condition %>
          <div>Hello</div>
        <% else %>
          <div>World</div>
        <% end %>
      `

      const result = autofix(input)

      expect(result.source).toBe(dedent`
        <div>
          <% if condition %>
            Hello
          <% else %>
            World
          <% end %>
        </div>
      `)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(1)
    })

    test("if/elsif/else with same wrapping element", () => {
      const input = dedent`
        <% if condition %>
          <div>Hello</div>
        <% elsif other %>
          <div>World</div>
        <% else %>
          <div>Default</div>
        <% end %>
      `

      const result = autofix(input)

      expect(result.source).toBe(dedent`
        <div>
          <% if condition %>
            Hello
          <% elsif other %>
            World
          <% else %>
            Default
          <% end %>
        </div>
      `)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(2)
    })

    test("unless/else with same wrapping element", () => {
      const input = dedent`
        <% unless condition %>
          <div>Hello</div>
        <% else %>
          <div>World</div>
        <% end %>
      `

      const result = autofix(input)

      expect(result.source).toBe(dedent`
        <div>
          <% unless condition %>
            Hello
          <% else %>
            World
          <% end %>
        </div>
      `)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(1)
    })

    test("case/when/else with same wrapping element", () => {
      const input = dedent`
        <% case value %>
        <% when "a" %>
          <div>Hello</div>
        <% when "b" %>
          <div>World</div>
        <% else %>
          <div>Default</div>
        <% end %>
      `

      const result = autofix(input)

      expect(result.source).toBe(dedent`
        <div>
          <% case value %>
            <% when "a" %>
              Hello
            <% when "b" %>
              World
            <% else %>
              Default
          <% end %>
        </div>
      `)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(2)
    })
  })

  describe("identical elements (bodies match)", () => {
    test("common prefix elements hoisted before conditional", () => {
      const input = dedent`
        <% if condition %>
          <header>Title</header>
          <div>Hello</div>
        <% else %>
          <header>Title</header>
          <span>World</span>
        <% end %>
      `

      const result = autofix(input)

      expect(result.source).toBe(dedent`
        <header>Title</header><% if condition %>
          <div>Hello</div>
        <% else %>
          <span>World</span>
        <% end %>
      `)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(1)
    })

    test("common suffix elements hoisted after conditional", () => {
      const input = dedent`
        <% if condition %>
          <div>Hello</div>
          <footer>Bottom</footer>
        <% else %>
          <span>World</span>
          <footer>Bottom</footer>
        <% end %>
      `

      const result = autofix(input)

      expect(result.source).toBe(dedent`
        <% if condition %>
          <div>Hello</div>
        <% else %>
          <span>World</span>
        <% end %><footer>Bottom</footer>
      `)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(1)
    })
  })

  describe("nested in element body", () => {
    test("works within element body", () => {
      const input = dedent`
        <main>
          <% if condition %>
            <div>Hello</div>
          <% else %>
            <div>World</div>
          <% end %>
        </main>
      `

      const result = autofix(input)

      expect(result.source).toBe(dedent`
        <main>
          <div>
            <% if condition %>
              Hello
            <% else %>
              World
            <% end %>
          </div>
        </main>
      `)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(1)
    })
  })

  describe("offense without autofixContext", () => {
    test("offenses without context are unfixed", () => {
      const input = dedent`
        <% if condition %>
          <div>Hello</div>
        <% else %>
          <div>World</div>
        <% end %>
      `

      const result = autofix(input)

      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(1)
    })
  })

})
