import { describe, it } from "vitest"
import dedent from "dedent"

import { ERBNoDuplicateBranchElementsRule } from "../../src/rules/erb-no-duplicate-branch-elements.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(ERBNoDuplicateBranchElementsRule)

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
      expectWarning("The `<div>` element is duplicated across all branches of this conditional and can be moved outside.")
      expectWarning("The `<div>` element is duplicated across all branches of this conditional and can be moved outside.")

      assertOffenses(dedent`
        <% if condition %>
          <div>Hello</div>
        <% else %>
          <div>World</div>
        <% end %>
      `)
    })

    it("case with same wrapping div but different whitesapce", () => {
      expectWarning("The `<div class=\"card\">` element is duplicated across all branches of this conditional and can be moved outside.")
      expectWarning("The `<div class=\"card\">` element is duplicated across all branches of this conditional and can be moved outside.")

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
      expectWarning("The `<div id=\"one\" class=\"card\">` element is duplicated across all branches of this conditional and can be moved outside.")
      expectWarning("The `<div class=\"card\" id=\"one\">` element is duplicated across all branches of this conditional and can be moved outside.")

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

    it("case with same wrapping div but differnt attribute formatting", () => {
      expectWarning("The `<div class=\"card\">` element is duplicated across all branches of this conditional and can be moved outside.")
      expectWarning("The `<div class=\"card\">` element is duplicated across all branches of this conditional and can be moved outside.")

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
  })

  describe("offense: if/elsif/else", () => {
    it("same wrapping element in all branches", () => {
      expectWarning("The `<div>` element is duplicated across all branches of this conditional and can be moved outside.")
      expectWarning("The `<div>` element is duplicated across all branches of this conditional and can be moved outside.")
      expectWarning("The `<div>` element is duplicated across all branches of this conditional and can be moved outside.")

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
      expectWarning("The `<div>` element is duplicated across all branches of this conditional and can be moved outside.")
      expectWarning("The `<div>` element is duplicated across all branches of this conditional and can be moved outside.")

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
      expectWarning("The `<div>` element is duplicated across all branches of this conditional and can be moved outside.")
      expectWarning("The `<div>` element is duplicated across all branches of this conditional and can be moved outside.")
      expectWarning("The `<div>` element is duplicated across all branches of this conditional and can be moved outside.")

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
      expectWarning("The `<div>` element is duplicated across all branches of this conditional and can be moved outside.")
      expectWarning("The `<div>` element is duplicated across all branches of this conditional and can be moved outside.")
      expectWarning("The `<p>` element is duplicated across all branches of this conditional and can be moved outside.")
      expectWarning("The `<p>` element is duplicated across all branches of this conditional and can be moved outside.")

      assertOffenses(dedent`
        <% if condition %>
          <div><p>Hello</p></div>
        <% else %>
          <div><p>World</p></div>
        <% end %>
      `)
    })

    it("flags only outer common elements", () => {
      expectWarning("The `<div>` element is duplicated across all branches of this conditional and can be moved outside.")
      expectWarning("The `<div>` element is duplicated across all branches of this conditional and can be moved outside.")

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
      expectWarning("The `<div>` element is duplicated across all branches of this conditional and can be moved outside.")
      expectWarning("The `<div>` element is duplicated across all branches of this conditional and can be moved outside.")
      expectWarning("The `<span>` element is duplicated across all branches of this conditional and can be moved outside.")
      expectWarning("The `<span>` element is duplicated across all branches of this conditional and can be moved outside.")

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
