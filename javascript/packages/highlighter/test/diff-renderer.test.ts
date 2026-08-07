import { describe, it, expect, beforeEach } from "vitest"
import dedent from "dedent"

import { Herb } from "@herb-tools/node-wasm"
import { themes } from "../src/themes.js"
import { ANSI_REGEX } from "../src/color.js"
import { stripAnsiColors } from "./util.js"

import { DiffRenderer } from "../src/diff-renderer.js"
import { computeDiffHunks } from "../src/diff-computer.js"
import { SyntaxRenderer } from "../src/syntax-renderer.js"

const hexBackground = (hex: string) =>
  `\x1b[48;2;${parseInt(hex.slice(1, 3), 16)};${parseInt(hex.slice(3, 5), 16)};${parseInt(hex.slice(5, 7), 16)}m`

const ADDED_SPAN = hexBackground(themes.onedark.DIFF_ADDED_BACKGROUND as string)
const REMOVED_SPAN = hexBackground(themes.onedark.DIFF_REMOVED_BACKGROUND as string)

describe("DiffRenderer", () => {
  let renderer: DiffRenderer

  beforeEach(async () => {
    const syntaxRenderer = new SyntaxRenderer(themes.onedark, Herb)
    await syntaxRenderer.initialize()
    renderer = new DiffRenderer(syntaxRenderer, themes.onedark)
  })

  const original = dedent`
    <div id="gems">
      <span class='card'>
        <%= render partial: "gem_card" %>
      </span>
      <img src="a.png">
    </div>
  `

  const modified = dedent`
    <div id="gems">
      <span class="card">
        <%= render partial: "gem_card" %>
      </span>
      <img src="a.png" alt="">
    </div>
  `

  it("renders nothing when the sources are identical", () => {
    expect(renderer.render("/test/file.erb", original, original)).toBe("")
  })

  it("renders removals and additions in the gutter alongside line numbers", () => {
    const result = renderer.render("/test/file.erb", original, modified, { wrapLines: false, contextLines: 1 })

    expect(stripAnsiColors(result)).toMatchSnapshot()
  })

  it("keeps context numbering monotonic when the fix changes the line count", () => {
    const shorter = dedent`
      <div>
        <span>one</span>
      </div>
    `

    const longer = dedent`
      <div>
        <span>one</span>
        <span>two</span>
      </div>
    `

    const result = renderer.render("/test/file.erb", shorter, longer, { wrapLines: false })

    expect(stripAnsiColors(result)).toMatchSnapshot()
  })

  it("separates distant hunks with a marker", () => {
    const before = ["<div>", "<a>", "<b>", "<c>", "<d>", "<e>", "<f>"].join("\n")
    const after = ["<div>", "<a2>", "<b>", "<c>", "<d>", "<e2>", "<f>"].join("\n")

    const result = renderer.render("/test/file.erb", before, after, { wrapLines: false, contextLines: 1 })

    expect(stripAnsiColors(result)).toContain("⋮")
    expect(stripAnsiColors(result)).toMatchSnapshot()
  })

  it("omits the header and gutter when line numbers are hidden", () => {
    const result = renderer.render("/test/file.erb", original, modified, {
      wrapLines: false,
      contextLines: 1,
      showLineNumbers: false,
    })

    expect(stripAnsiColors(result)).toMatchSnapshot()
  })

  it("indents the whole diff for nesting under an offense", () => {
    const result = renderer.render("", original, modified, {
      wrapLines: false,
      contextLines: 0,
      indent: "      ",
    })

    expect(stripAnsiColors(result)).toMatchSnapshot()
  })

  it("truncates long lines when asked", () => {
    const before = `<div class="${"a".repeat(200)}">old</div>`
    const after = `<div class="${"a".repeat(200)}">new</div>`

    const result = renderer.render("/test/file.erb", before, after, { truncateLines: true, maxWidth: 60 })

    expect(stripAnsiColors(result)).toContain("…")
    expect(stripAnsiColors(result)).toMatchSnapshot()
  })

  describe("inline change highlighting", () => {
    it("backgrounds only the characters that changed, keeping syntax colors", () => {
      const result = renderer.render("/test/file.erb", original, modified, { wrapLines: false, contextLines: 0 })

      expect(result).toMatch(ANSI_REGEX)
      expect(result).toMatchSnapshot()
    })

    it("leaves lines unmarked when a block was restructured rather than rewritten in place", () => {
      const before = dedent`
        <div>
          <span>content</span>
        </div>
      `

      const after = dedent`
        <div>
          <section>
            <span>content</span>
          </section>
        </div>
      `

      const result = renderer.render("/test/file.erb", before, after, { wrapLines: false, contextLines: 0 })

      expect(result).not.toContain(REMOVED_SPAN)
      expect(result).not.toContain(ADDED_SPAN)
    })

    it("marks the inserted indentation when a block is re-indented line for line", () => {
      const before = ["<div>", "<span>one</span>", "<span>two</span>", "</div>"].join("\n")
      const after = ["<div>", "  <span>one</span>", "  <span>two</span>", "</div>"].join("\n")

      const result = renderer.render("/test/file.erb", before, after, { wrapLines: false, contextLines: 0 })

      expect(result).toContain(ADDED_SPAN)
      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("can be turned off", () => {
      const result = renderer.render("/test/file.erb", original, modified, {
        wrapLines: false,
        contextLines: 0,
        highlightInlineChanges: false,
      })

      expect(result).not.toContain(REMOVED_SPAN)
      expect(result).not.toContain(ADDED_SPAN)
    })
  })

  describe("split layout", () => {
    it("puts the original on the left and the modified on the right", () => {
      const result = renderer.render("", original, modified, { layout: "split", contextLines: 1, maxWidth: 140 })

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("numbers each column from its own version of the file", () => {
      const before = ["<div>", "  <span>x</span>", "</div>"].join("\n")
      const after = ["<div>", "  <section>", "    <span>x</span>", "  </section>", "</div>"].join("\n")

      const result = stripAnsiColors(renderer.render("", before, after, { layout: "split", contextLines: 1, maxWidth: 140 }))

      const lastRow = result.split("\n").at(-1)!
      const [left, right] = lastRow.split("┃")

      expect(left).toContain("3 │ </div>")
      expect(right).toContain("5 │ </div>")
    })

    it("leaves the shorter side blank when the two runs differ in length", () => {
      const before = ["<div>", "  <span>x</span>", "</div>"].join("\n")
      const after = ["<div>", "  <section>", "    <span>x</span>", "  </section>", "</div>"].join("\n")

      const result = stripAnsiColors(renderer.render("", before, after, { layout: "split", contextLines: 0, maxWidth: 140 }))

      expect(result).toMatchSnapshot()
    })

    it("falls back to the unified layout when the columns would be too narrow", () => {
      const result = stripAnsiColors(renderer.render("", original, modified, { layout: "split", contextLines: 1, maxWidth: 70 }))

      expect(result).not.toContain("┃")
      expect(result).toContain("-   2")
    })
  })

  describe("single-line collapsing", () => {
    const isolated = {
      before: dedent`
        <div>
          <span class='a'>one</span>
          <p>untouched</p>
        </div>
      `,
      after: dedent`
        <div>
          <span class="a">one</span>
          <p>untouched</p>
        </div>
      `,
    }

    it("collapses an isolated one-for-one replacement onto a single line", () => {
      const result = renderer.render("", isolated.before, isolated.after, {
        wrapLines: false,
        contextLines: 1,
        singleLineStyle: "inline",
      })

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("splits the same change by default", () => {
      const result = renderer.render("", isolated.before, isolated.after, { wrapLines: false, contextLines: 1 })

      expect(stripAnsiColors(result)).toContain("-   2")
      expect(stripAnsiColors(result)).toContain("+")
    })

    it("declines to collapse when a line has two separate edits", () => {
      const before = ["<div>", "  <span class='a' id='b'>x</span>", "</div>"].join("\n")
      const after = ["<div>", `  <span class="a" id="b">x</span>`, "</div>"].join("\n")

      const result = renderer.render("", before, after, { wrapLines: false, contextLines: 1, singleLineStyle: "inline" })

      expect(stripAnsiColors(result)).not.toContain("±")
    })

    it("declines to collapse a multi-line restructure", () => {
      const before = ["<div>", "  <span>x</span>", "</div>"].join("\n")
      const after = ["<div>", "  <section>", "    <span>x</span>", "  </section>", "</div>"].join("\n")

      const result = renderer.render("", before, after, { wrapLines: false, contextLines: 1, singleLineStyle: "inline" })

      expect(stripAnsiColors(result)).not.toContain("±")
    })

    it("falls back to splitting when color is off, since the composite needs tinting to be read", () => {
      const originalNoColor = process.env.NO_COLOR
      process.env.NO_COLOR = "1"

      try {
        const result = renderer.render("", isolated.before, isolated.after, {
          wrapLines: false,
          contextLines: 1,
          singleLineStyle: "inline",
        })

        expect(result).not.toContain("±")
        expect(result).not.toMatch(ANSI_REGEX)
        expect(result).toMatchSnapshot()
      } finally {
        if (originalNoColor === undefined) {
          delete process.env.NO_COLOR
        } else {
          process.env.NO_COLOR = originalNoColor
        }
      }
    })
  })

  describe("auto collapsing", () => {
    const wrap = (line: string) => ["<div>", line, "</div>"].join("\n")

    const collapses = (before: string, after: string, maxWidth = 120) =>
      renderer.render("", wrap(before), wrap(after), {
        contextLines: 0,
        wrapLines: false,
        singleLineStyle: "auto",
        maxWidth,
      }).includes("±")

    it("collapses a pure insertion, whose composite is a real line", () => {
      expect(collapses(`  <img src="a.png">`, `  <img src="a.png" alt="">`)).toBe(true)
    })

    it("collapses a pure deletion", () => {
      expect(collapses(`  <img src="a.png" onclick="x()">`, `  <img src="a.png">`)).toBe(true)
    })

    it("collapses a small replacement", () => {
      expect(collapses(`  <span class='a'>one</span>`, `  <span class="a">one</span>`)).toBe(true)
    })

    it("keeps a long replacement split", () => {
      expect(collapses(
        `  <span class='alpha beta gamma delta'>one</span>`,
        `  <span class="totally different set of names here">one</span>`,
      )).toBe(false)
    })

    it("keeps a replacement covering most of the line split", () => {
      expect(collapses(`  <a href='/old'>Old</a>`, `  <button data-x='y'>New</button>`)).toBe(false)
    })

    it("keeps a change split when the composite would not fit the width", () => {
      const before = `  <span class='a'>${"x".repeat(50)}</span>`
      const after = `  <span class="a">${"x".repeat(50)}</span>`

      expect(collapses(before, after, 120)).toBe(true)
      expect(collapses(before, after, 80)).toBe(false)
    })

    it("collapses nothing when color is off", () => {
      const originalNoColor = process.env.NO_COLOR
      process.env.NO_COLOR = "1"

      try {
        expect(collapses(`  <img src="a.png">`, `  <img src="a.png" alt="">`)).toBe(false)
      } finally {
        if (originalNoColor === undefined) {
          delete process.env.NO_COLOR
        } else {
          process.env.NO_COLOR = originalNoColor
        }
      }
    })
  })

  describe("renderFromHunks", () => {
    it("renders hunks that arrived without their sources", () => {
      const hunks = computeDiffHunks(original, modified, 1)
      const result = renderer.renderFromHunks("/test/file.erb", hunks, { wrapLines: false })

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("matches what rendering from the sources produces", () => {
      const hunks = computeDiffHunks(original, modified, 1)

      const fromHunks = renderer.renderFromHunks("/test/file.erb", hunks, { wrapLines: false, contextLines: 1 })
      const fromSources = renderer.render("/test/file.erb", original, modified, { wrapLines: false, contextLines: 1 })

      expect(stripAnsiColors(fromHunks)).toBe(stripAnsiColors(fromSources))
    })

    it("renders nothing when given no hunks", () => {
      expect(renderer.renderFromHunks("/test/file.erb", [])).toBe("")
    })
  })

  describe("NO_COLOR environment", () => {
    it("renders the diff without any escape codes", () => {
      const originalNoColor = process.env.NO_COLOR
      process.env.NO_COLOR = "1"

      try {
        const result = renderer.render("/test/file.erb", original, modified, { wrapLines: false, contextLines: 1 })

        expect(result).not.toMatch(ANSI_REGEX)
        expect(result).toMatchSnapshot()
      } finally {
        if (originalNoColor === undefined) {
          delete process.env.NO_COLOR
        } else {
          process.env.NO_COLOR = originalNoColor
        }
      }
    })
  })
})
