import { describe, it, expect } from "vitest"
import dedent from "dedent"

import { computeDiffHunks, computeInlineRanges, parseUnifiedDiff } from "../src/diff-computer.js"

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

describe("parseUnifiedDiff", () => {
  const gitDiff = dedent`
    diff --git a/app/views/gems/index.html.erb b/app/views/gems/index.html.erb
    index 1a2b3c4..5d6e7f8 100644
    --- a/app/views/gems/index.html.erb
    +++ b/app/views/gems/index.html.erb
    @@ -1,4 +1,4 @@
     <div id="gems">
    -  <span class='card'>x</span>
    +  <span class="card">x</span>
     </div>
  `

  it("reads the path and the hunk out of git diff output", () => {
    const files = parseUnifiedDiff(gitDiff)

    expect(files).toHaveLength(1)
    expect(files[0].path).toBe("app/views/gems/index.html.erb")
    expect(files[0].hunks[0].lines).toEqual([
      { type: "context", content: `<div id="gems">`, oldLineNumber: 1, newLineNumber: 1 },
      { type: "removed", content: `  <span class='card'>x</span>`, oldLineNumber: 2, newLineNumber: null },
      { type: "added", content: `  <span class="card">x</span>`, oldLineNumber: null, newLineNumber: 2 },
      { type: "context", content: "</div>", oldLineNumber: 3, newLineNumber: 3 },
    ])
  })

  it("carries the line numbers from the hunk header", () => {
    const [file] = parseUnifiedDiff(dedent`
      --- a/x.erb
      +++ b/x.erb
      @@ -40,3 +58,3 @@
       <div>
      -  old
      +  new
    `)

    expect(file.hunks[0].oldStart).toBe(40)
    expect(file.hunks[0].newStart).toBe(58)
    expect(file.hunks[0].lines.map(line => [line.oldLineNumber, line.newLineNumber])).toEqual([
      [40, 58],
      [41, null],
      [null, 59],
    ])
  })

  it("keeps each file of a multi-file diff separate", () => {
    const files = parseUnifiedDiff(dedent`
      --- a/one.erb
      +++ b/one.erb
      @@ -1 +1 @@
      -<P>a</P>
      +<p>a</p>
      --- a/two.erb
      +++ b/two.erb
      @@ -1 +1 @@
      -<B>b</B>
      +<b>b</b>
    `)

    expect(files.map(file => file.path)).toEqual(["one.erb", "two.erb"])
    expect(files.every(file => file.hunks.length === 1)).toBe(true)
  })

  it("handles several hunks in one file", () => {
    const [file] = parseUnifiedDiff(dedent`
      --- a/x.erb
      +++ b/x.erb
      @@ -1,2 +1,2 @@
      -<a>
      +<A>
       <p>
      @@ -20,2 +20,2 @@
      -<b>
      +<B>
       <q>
    `)

    expect(file.hunks).toHaveLength(2)
    expect(file.hunks[1].oldStart).toBe(20)
  })

  it("skips the no-newline marker rather than treating it as content", () => {
    const [file] = parseUnifiedDiff(dedent`
      --- a/x.erb
      +++ b/x.erb
      @@ -1 +1 @@
      -<p>a</p>
      \\ No newline at end of file
      +<p>b</p>
    `)

    expect(file.hunks[0].lines.map(line => line.type)).toEqual(["removed", "added"])
  })

  it("returns nothing for text that holds no hunks", () => {
    expect(parseUnifiedDiff("just some prose\nwith no diff in it")).toEqual([])
  })
})
