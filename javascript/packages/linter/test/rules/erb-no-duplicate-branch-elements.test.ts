import { describe, it } from "vitest"
import dedent from "dedent"

import { ERBNoDuplicateBranchElementsRule } from "../../src/rules/erb-no-duplicate-branch-elements.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, expectHint, assertOffenses } = createLinterTest(ERBNoDuplicateBranchElementsRule)

describe("erb-no-duplicate-branch-elements", () => {
  describe("no offense", () => {
    it("branches with different elements", () => {
      expectNoOffenses(dedent`
        <% if condition %>
          <div>Hello</div>
        <% else %>
          <span>World</span>
        <% end %>
      `)
    })

    it("if without else (incomplete coverage)", () => {
      expectNoOffenses(dedent`
        <% if condition %>
          <div>Hello</div>
        <% end %>
      `)
    })

    it("branches with same tag name but different attributes", () => {
      expectNoOffenses(dedent`
        <% if condition %>
          <div class="a">Hello</div>
        <% else %>
          <div class="b">World</div>
        <% end %>
      `)
    })

    it("branches with same tag name but different class tokens", () => {
      expectNoOffenses(dedent`
        <% if condition %>
          <div class="a b">Hello</div>
        <% else %>
          <div class="a c">World</div>
        <% end %>
      `)
    })

    it("only some branches match (not all)", () => {
      expectNoOffenses(dedent`
        <% if condition %>
          <div class="wrapper">Hello</div>
        <% elsif other %>
          <span>Different</span>
        <% else %>
          <div class="wrapper">World</div>
        <% end %>
      `)
    })

    it("branches with different text content", () => {
      expectNoOffenses(dedent`
        <% if condition %>
          Hello
        <% else %>
          World
        <% end %>
      `)
    })

    it("branches with identical text content", () => {
      expectWarning("All branches of this conditional have identical content. The conditional can be removed.")

      assertOffenses(dedent`
        <% if condition? %>
          123
        <% else %>
          123
        <% end %>
      `)
    })

    it("branches with identical multi-element content", () => {
      expectWarning("All branches of this conditional have identical content. The conditional can be removed.")

      assertOffenses(dedent`
        <% if condition? %>
          <h1>Hello</h1>
          <div><%= hello %></div>
          <h1>World</h1>
        <% else %>
          <h1>Hello</h1>
          <div><%= hello %></div>
          <h1>World</h1>
        <% end %>
      `)
    })

    it("identical prefix, different middle, identical suffix", () => {
      expectWarning("The `<h1>` element is duplicated across all branches of this conditional and can be moved outside.")
      expectWarning("The `<h1>` element is duplicated across all branches of this conditional and can be moved outside.")
      expectHint("The `<div>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectHint("The `<div>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectWarning("The `<h1>` element is duplicated across all branches of this conditional and can be moved outside.")
      expectWarning("The `<h1>` element is duplicated across all branches of this conditional and can be moved outside.")

      assertOffenses(dedent`
        <% if condition? %>
          <h1>Hello</h1>
          <div>One</div>
          <h1>World</h1>
        <% else %>
          <h1>Hello</h1>
          <div>Two</div>
          <h1>World</h1>
        <% end %>
      `)
    })

    it("branches with different prefix and identical suffix element", () => {
      expectHint("The `<h1>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectHint("The `<h1>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectWarning("The `<div>` element is duplicated across all branches of this conditional and can be moved outside.")
      expectWarning("The `<div>` element is duplicated across all branches of this conditional and can be moved outside.")

      assertOffenses(dedent`
        <% if condition? %>
          <h1>Hello</h1>
          <div><%= hello %></div>
        <% else %>
          <h1>World</h1>
          <div><%= hello %></div>
        <% end %>
      `)
    })

    it("branches with identical elements containing ERB output", () => {
      expectWarning("All branches of this conditional have identical content. The conditional can be removed.")

      assertOffenses(dedent`
        <% if condition? %>
          <div><%= hello %></div>
        <% else %>
          <div><%= hello %></div>
        <% end %>
      `)
    })

    it("branches with identical ERB output", () => {
      expectWarning("All branches of this conditional have identical content. The conditional can be removed.")

      assertOffenses(dedent`
        <% if condition? %>
          <%= hello %>
        <% else %>
          <%= hello %>
        <% end %>
      `)
    })

    it("unless without else (incomplete coverage)", () => {
      expectNoOffenses(dedent`
        <% unless condition %>
          <div>Hello</div>
        <% end %>
      `)
    })

    it("case without else (incomplete coverage)", () => {
      expectNoOffenses(dedent`
        <% case value %>
        <% when "a" %>
          <div>Hello</div>
        <% when "b" %>
          <div>World</div>
        <% end %>
      `)
    })
  })

  describe("offense: if/else", () => {
    it("basic case with same wrapping div", () => {
      expectHint("The `<div>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectHint("The `<div>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")

      assertOffenses(dedent`
        <% if condition %>
          <div>Hello</div>
        <% else %>
          <div>World</div>
        <% end %>
      `)
    })

    it("case with same wrapping div but different whitesapce", () => {
      expectHint("The `<div class=\"card\">` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectHint("The `<div class=\"card\">` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")

      assertOffenses(dedent`
        <% if condition %>
          <div class="card">
            <span>Hello</span>
          </div>
        <% else %>
          <div class="card">World</div>
        <% end %>
      `)
    })

    it("case with same wrapping div but attributes in different order", () => {
      expectHint("The `<div id=\"one\" class=\"card\">` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectHint("The `<div class=\"card\" id=\"one\">` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")

      assertOffenses(dedent`
        <% if condition %>
          <div id="one" class="card">
            <span>Hello</span>
          </div>
        <% else %>
          <div class="card" id="one">World</div>
        <% end %>
      `)
    })

    it("case with same classes in different order", () => {
      expectHint("The `<div class=\"b a\">` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectHint("The `<div class=\"a b\">` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")

      assertOffenses(dedent`
        <% if condition %>
          <div class="b a">Hello</div>
        <% else %>
          <div class="a b">World</div>
        <% end %>
      `)
    })

    it("case with same data-controller tokens in different order", () => {
      expectHint("The `<div data-controller=\"b a\">` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectHint("The `<div data-controller=\"a b\">` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")

      assertOffenses(dedent`
        <% if condition %>
          <div data-controller="b a">Hello</div>
        <% else %>
          <div data-controller="a b">World</div>
        <% end %>
      `)
    })

    it("non-token-list attributes with different order are not equivalent", () => {
      expectNoOffenses(dedent`
        <% if condition %>
          <div style="color: red; font-size: 12px">Hello</div>
        <% else %>
          <div style="font-size: 12px; color: red">World</div>
        <% end %>
      `)
    })

    it("case with same wrapping div but differnt attribute formatting", () => {
      expectHint("The `<div class=\"\n    card\n  \">` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectHint("The `<div class=\"card\">` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")

      assertOffenses(dedent`
        <% if condition %>
          <div class="
            card
          ">
            <span>Hello</span>
          </div>
        <% else %>
          <div class="card">World</div>
        <% end %>
      `)
    })

    it("fully identical elements trigger identical branches warning", () => {
      expectWarning("All branches of this conditional have identical content. The conditional can be removed.")

      assertOffenses(dedent`
        <% if condition %>
          <div>Same</div>
        <% else %>
          <div>Same</div>
        <% end %>
      `)
    })

    it("identical elements with different bodies are per-element warnings", () => {
      expectWarning("The `<div>` element is duplicated across all branches of this conditional and can be moved outside.")
      expectWarning("The `<div>` element is duplicated across all branches of this conditional and can be moved outside.")
      expectHint("The `<span>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectHint("The `<span>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")

      assertOffenses(dedent`
        <% if condition %>
          <div>Hello</div>
          <span>unique to if</span>
        <% else %>
          <div>Hello</div>
          <span>unique to else</span>
        <% end %>
      `)
    })
  })

  describe("offense: if/elsif/else", () => {
    it("same wrapping element in all branches", () => {
      expectHint("The `<div>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectHint("The `<div>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectHint("The `<div>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")

      assertOffenses(dedent`
        <% if condition %>
          <div>Hello</div>
        <% elsif other %>
          <div>World</div>
        <% else %>
          <div>Default</div>
        <% end %>
      `)
    })
  })

  describe("offense: unless/else", () => {
    it("same wrapping element", () => {
      expectHint("The `<div>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectHint("The `<div>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")

      assertOffenses(dedent`
        <% unless condition %>
          <div>Hello</div>
        <% else %>
          <div>World</div>
        <% end %>
      `)
    })
  })

  describe("offense: case/when/else", () => {
    it("same wrapping element", () => {
      expectHint("The `<div>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectHint("The `<div>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectHint("The `<div>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")

      assertOffenses(dedent`
        <% case value %>
        <% when "a" %>
          <div>Hello</div>
        <% when "b" %>
          <div>World</div>
        <% else %>
          <div>Default</div>
        <% end %>
      `)
    })
  })

  describe("offense: common prefix elements", () => {
    it("first N elements match across branches", () => {
      expectWarning("The `<header>` element is duplicated across all branches of this conditional and can be moved outside.")
      expectWarning("The `<header>` element is duplicated across all branches of this conditional and can be moved outside.")

      assertOffenses(dedent`
        <% if condition %>
          <header>Title</header>
          <div>Hello</div>
        <% else %>
          <header>Title</header>
          <span>World</span>
        <% end %>
      `)
    })
  })

  describe("offense: common suffix elements", () => {
    it("last N elements match across branches", () => {
      expectWarning("The `<footer>` element is duplicated across all branches of this conditional and can be moved outside.")
      expectWarning("The `<footer>` element is duplicated across all branches of this conditional and can be moved outside.")

      assertOffenses(dedent`
        <% if condition %>
          <div>Hello</div>
          <footer>Bottom</footer>
        <% else %>
          <span>World</span>
          <footer>Bottom</footer>
        <% end %>
      `)
    })
  })

  describe("offense: recursive descent", () => {
    it("flags both outer and inner common elements", () => {
      expectHint("The `<div>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectHint("The `<div>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectHint("The `<p>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectHint("The `<p>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")

      assertOffenses(dedent`
        <% if condition %>
          <div><p>Hello</p></div>
        <% else %>
          <div><p>World</p></div>
        <% end %>
      `)
    })

    it("flags only outer common elements", () => {
      expectHint("The `<div>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectHint("The `<div>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")

      assertOffenses(dedent`
        <% if condition %>
          <div><p id="one">Hello</p></div>
        <% else %>
          <div><p id="two">World</p></div>
        <% end %>
      `)
    })

    it("doesnt flag only inner common elements when outer doesn't match", () => {
      expectNoOffenses(dedent`
        <% if condition %>
          <div id="one"><p>Hello</p></div>
        <% else %>
          <div id="two"><p>World</p></div>
        <% end %>
      `)
    })
  })

  describe("offense: nested conditionals flagged independently", () => {
    it("each conditional is checked separately", () => {
      expectHint("The `<div>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectHint("The `<div>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectHint("The `<span>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")
      expectHint("The `<span>` tag is repeated across all branches with different content. Consider extracting the shared tag outside the conditional.")

      assertOffenses(dedent`
        <% if outer %>
          <div>
            <% if inner %>
              <span>Hello</span>
            <% else %>
              <span>World</span>
            <% end %>
          </div>
        <% else %>
          <div>
            <p>Other</p>
          </div>
        <% end %>
      `)
    })
  })
})
