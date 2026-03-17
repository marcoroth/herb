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

  describe("wrapping element (bodies differ, single element per branch)", () => {
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
        <header>Title</header>
        <% if condition %>
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
        <% end %>
        <footer>Bottom</footer>
      `)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(1)
    })
  })

  describe("multiple elements with different bodies", () => {
    test("does not wrap when branches have multiple sibling elements with different bodies", () => {
      const input = dedent`
        <% if condition %>
          <h3 class="title">Finish setting up</h3>
          <p class="desc">Complete your setup.</p>
          <div class="actions">
            <a href="/setup">Setup</a>
          </div>
        <% else %>
          <h3 class="title">No items</h3>
          <p class="desc">Get started by creating one.</p>
          <div class="actions">
            <a href="/new">Create</a>
          </div>
        <% end %>
      `

      const result = autofix(input)

      expect(result.source).toBe(input)
      expect(result.fixed).toHaveLength(0)
    })

    test("wraps after identical prefix elements are hoisted", () => {
      const input = dedent`
        <% if condition %>
          <header>Title</header>
          <div class="wrapper">Content A</div>
        <% else %>
          <header>Title</header>
          <div class="wrapper">Content B</div>
        <% end %>
      `

      const result = autofix(input)

      expect(result.source).toBe(dedent`
        <header>Title</header>
        <div class="wrapper">
          <% if condition %>
            Content A
          <% else %>
            Content B
          <% end %>
        </div>
      `)
      expect(result.fixed).toHaveLength(1)
    })

    test("identical prefix then different suffix: hoists prefix only", () => {
      const input = dedent`
        <% if condition %>
          <header>Title</header>
          <div class="wrapper-1">Content A</div>
        <% else %>
          <header>Title</header>
          <div class="wrapper-2">Content B</div>
        <% end %>
      `

      const result = autofix(input)

      expect(result.source).toBe(dedent`
        <header>Title</header>
        <% if condition %>
          <div class="wrapper-1">Content A</div>
        <% else %>
          <div class="wrapper-2">Content B</div>
        <% end %>
      `)
      expect(result.fixed).toHaveLength(1)
    })

    test("different first element, identical second element: hoists second element after conditional", () => {
      const input = dedent`
        <% if condition? %>
          <h1>Hello</h1>
          <div><%= hello %></div>
        <% else %>
          <h1>World</h1>
          <div><%= hello %></div>
        <% end %>
      `

      const result = autofix(input)

      expect(result.source).toBe(dedent`
        <% if condition? %>
          <h1>Hello</h1>
        <% else %>
          <h1>World</h1>
        <% end %>
        <div><%= hello %></div>
      `)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(3)
    })

    test("reversed content in branches: no autofix", () => {
      const input = dedent`
        <% if condition %>
          <div>Hello</div>
          <span>World</span>
        <% else %>
          <span>World</span>
          <div>Hello</div>
        <% end %>
      `

      const result = autofix(input)

      expect(result.source).toBe(input)
      expect(result.fixed).toHaveLength(0)
    })

    test("identical prefix and suffix elements hoisted before and after, remaining element wrapped", () => {
      const input = dedent`
        <% if condition? %>
          <h1>Hello</h1>
          <div>One</div>
          <h1>World</h1>
        <% else %>
          <h1>Hello</h1>
          <div>Two</div>
          <h1>World</h1>
        <% end %>
      `

      const result = autofix(input)

      expect(result.source).toBe(dedent`
        <h1>Hello</h1>
        <div>
          <% if condition? %>
            One
          <% else %>
            Two
          <% end %>
        </div>
        <h1>World</h1>
      `)
      expect(result.fixed).toHaveLength(1)
    })

    test("identical prefix hoisted before even when branches have different lengths", () => {
      const input = dedent`
        <% if condition? %>
          <h1>Hello</h1>
          <div><%= hello %></div>
          <h1>World</h1>
        <% else %>
          <h1>Hello</h1> Text
          <div><%= hello %></div>
          <h1>World</h1>
        <% end %>
      `

      const result = autofix(input)

      expect(result.source).toBe(dedent`
        <h1>Hello</h1>
        <% if condition? %>
          <div><%= hello %></div>
          <h1>World</h1>
        <% else %> Text
          <div><%= hello %></div>
          <h1>World</h1>
        <% end %>
      `)
      expect(result.fixed).toHaveLength(1)
    })

    test("identical middle element with different surrounding elements: no autofix", () => {
      const input = dedent`
        <% if condition? %>
          <h1>Hello</h1>
          <div><%= hello %></div>
          <h1>World</h1>
        <% else %>
          <h1>World</h1>
          <div><%= hello %></div>
          <h1>Hello</h1>
        <% end %>
      `

      const result = autofix(input)

      expect(result.source).toBe(input)
      expect(result.fixed).toHaveLength(0)
    })
  })

  describe("branches with ERB output nodes", () => {
    test("div with different bodies not hoisted", () => {
      const input = dedent`
        <% if condition? %>
          <% id = "one" %>
          <div id="<%= id %>">One</div>
        <% else %>
          <% id = "two" %>
          <div id="<%= id %>">Two</div>
        <% end %>
      `

      const result = autofix(input)

      expect(result.source).toBe(input)
      expect(result.fixed).toHaveLength(0)
    })

    test("identical div suffix with erb attribute hoisted after conditional", () => {
      const input = dedent`
        <% if condition? %>
          <% id = "one" %>
          <div id="<%= id %>">One</div>
        <% else %>
          <% id = "two" %>
          <div id="<%= id %>">One</div>
        <% end %>
      `

      const result = autofix(input)

      expect(result.source).toBe(dedent`
        <% if condition? %>
          <% id = "one" %>
        <% else %>
          <% id = "two" %>
        <% end %>
        <div id="<%= id %>">One</div>
      `)
      expect(result.fixed).toHaveLength(1)
    })
  })

  describe("all branches identical", () => {
    test("identical text content: removes conditional", () => {
      const input = dedent`
        <% if condition? %>
          123
        <% else %>
          123
        <% end %>
      `

      const result = autofix(input)

      expect(result.source).toBe("\n123\n")
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("identical elements: removes conditional", () => {
      const input = dedent`
        <% if condition? %>
          <div><%= hello %></div>
        <% else %>
          <div><%= hello %></div>
        <% end %>
      `

      const result = autofix(input)

      expect(result.source).toBe("<div><%= hello %></div>")
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("identical multi-element content: removes conditional", () => {
      const input = dedent`
        <% if condition? %>
          <h1>Hello</h1>
          <div><%= hello %></div>
          <h1>World</h1>
        <% else %>
          <h1>Hello</h1>
          <div><%= hello %></div>
          <h1>World</h1>
        <% end %>
      `

      const result = autofix(input)

      expect(result.source).toBe(dedent`
        <h1>Hello</h1>
        <div><%= hello %></div>
        <h1>World</h1>
      `)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })
  })
})
