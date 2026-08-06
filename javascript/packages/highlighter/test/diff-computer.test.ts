import { describe, it, expect } from "vitest"
import dedent from "dedent"

import { computeDiffHunks, computeInlineRanges } from "../src/diff-computer.js"

describe("computeDiffHunks", () => {
  it("returns no hunks for identical sources", () => {
    const source = dedent`
      <div>
        <span>content</span>
      </div>
    `

    expect(computeDiffHunks(source, source)).toEqual([])
  })

  it("pairs a replaced line as a removal followed by an addition", () => {
    const original = dedent`
      <div>
        <span class='card'>
      </div>
    `

    const modified = dedent`
      <div>
        <span class="card">
      </div>
    `

    const hunks = computeDiffHunks(original, modified)

    expect(hunks).toHaveLength(1)
    expect(hunks[0].lines).toEqual([
      { type: "context", content: "<div>", oldLineNumber: 1, newLineNumber: 1 },
      { type: "removed", content: `  <span class='card'>`, oldLineNumber: 2, newLineNumber: null },
      { type: "added", content: `  <span class="card">`, oldLineNumber: null, newLineNumber: 2 },
      { type: "context", content: "</div>", oldLineNumber: 3, newLineNumber: 3 },
    ])
  })

  it("tracks line numbers independently once the line count changes", () => {
    const original = dedent`
      <div>
        <span>one</span>
      </div>
    `

    const modified = dedent`
      <div>
        <span>one</span>
        <span>two</span>
      </div>
    `

    const hunks = computeDiffHunks(original, modified)

    expect(hunks[0].lines.map(line => [line.type, line.oldLineNumber, line.newLineNumber])).toEqual([
      ["context", 1, 1],
      ["context", 2, 2],
      ["added", null, 3],
      ["context", 3, 4],
    ])
  })

  it("splits distant changes into separate hunks", () => {
    const original = ["a", "b", "c", "d", "e", "f", "g", "h", "i"].join("\n")
    const modified = ["A", "b", "c", "d", "e", "f", "g", "h", "I"].join("\n")

    const hunks = computeDiffHunks(original, modified, 1)

    expect(hunks).toHaveLength(2)
    expect(hunks[0].lines.map(line => line.content)).toEqual(["a", "A", "b"])
    expect(hunks[1].lines.map(line => line.content)).toEqual(["h", "i", "I"])
  })

  it("keeps nearby changes in a single hunk", () => {
    const original = ["a", "b", "c", "d", "e"].join("\n")
    const modified = ["A", "b", "c", "d", "E"].join("\n")

    expect(computeDiffHunks(original, modified, 2)).toHaveLength(1)
  })

  it("reports hunk ranges for both sides", () => {
    const original = ["a", "b", "c"].join("\n")
    const modified = ["a", "b", "b2", "c"].join("\n")

    const [hunk] = computeDiffHunks(original, modified)

    expect(hunk.oldStart).toBe(1)
    expect(hunk.oldCount).toBe(3)
    expect(hunk.newStart).toBe(1)
    expect(hunk.newCount).toBe(4)
  })

  it("handles a pure insertion into an empty source", () => {
    const hunks = computeDiffHunks("", "<div></div>")

    expect(hunks[0].lines).toEqual([
      { type: "removed", content: "", oldLineNumber: 1, newLineNumber: null },
      { type: "added", content: "<div></div>", oldLineNumber: null, newLineNumber: 1 },
    ])
  })
})

describe("computeInlineRanges", () => {
  it("returns the changed characters on each side", () => {
    const { removed, added } = computeInlineRanges(`  <span class='card'>`, `  <span class="card">`)

    expect(removed).toEqual([{ start: 14, end: 15 }, { start: 19, end: 20 }])
    expect(added).toEqual([{ start: 14, end: 15 }, { start: 19, end: 20 }])
  })

  it("marks only the inserted text for a pure insertion", () => {
    const { removed, added } = computeInlineRanges(`<img src="a.png">`, `<img src="a.png" alt="">`)

    expect(removed).toEqual([])
    expect(added).toEqual([{ start: 16, end: 23 }])
  })

  it("returns nothing for identical lines", () => {
    expect(computeInlineRanges("<div>", "<div>")).toEqual({ removed: [], added: [] })
  })

  it("gives up when the lines share too little to be worth refining", () => {
    expect(computeInlineRanges("<div>hello</div>", "<section data-x>completely other</section>")).toEqual({
      removed: [],
      added: [],
    })
  })

  it("merges changed spans separated by only a few unchanged characters", () => {
    const { added } = computeInlineRanges("a-b-c-d", "aXbXcXd")

    expect(added).toEqual([{ start: 1, end: 6 }])
  })

  it("skips refinement for very long lines", () => {
    const long = "a".repeat(600)

    expect(computeInlineRanges(long, `${long}b`)).toEqual({ removed: [], added: [] })
  })
})
