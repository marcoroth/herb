import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { ERBNoTrailingWhitespaceRule } from "../../src/rules/erb-no-trailing-whitespace.js"

describe("erb-no-trailing-whitespace autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("removes trailing spaces", () => {
    const input = "Hello   "
    const expected = "Hello"

    const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
    const result = linter.autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("removes trailing tab", () => {
    const input = "Hello\t"
    const expected = "Hello"

    const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
    const result = linter.autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("removes all occurrences of trailing whitespace", () => {
    const input = "Hello \nWorld \nClean"
    const expected = "Hello\nWorld\nClean"

    const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
    const result = linter.autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("removes whitespace-only content from blank lines", () => {
    const input = "<div>\n   \n</div>"
    const expected = "<div>\n\n</div>"

    const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
    const result = linter.autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("removes trailing whitespace after HTML tags", () => {
    const input = "<div>Hello</div>  \n<p>World</p>"
    const expected = "<div>Hello</div>\n<p>World</p>"

    const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
    const result = linter.autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("handles mixed whitespace", () => {
    const input = "Hello \t "
    const expected = "Hello"

    const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
    const result = linter.autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not modify file without trailing whitespace", () => {
    const input = "<div>\n  <p>Hello</p>\n</div>"
    const expected = "<div>\n  <p>Hello</p>\n</div>"

    const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
    const result = linter.autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("handles empty file", () => {
    const input = ""
    const expected = ""

    const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
    const result = linter.autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("preserves indentation while removing trailing whitespace", () => {
    const input = "  <div> \n    <p>Hello</p> \n  </div>"
    const expected = "  <div>\n    <p>Hello</p>\n  </div>"

    const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
    const result = linter.autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("preserves newlines while removing trailing whitespace", () => {
    const input = "Hello \n\nWorld \n"
    const expected = "Hello\n\nWorld\n"

    const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
    const result = linter.autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  describe("skip elements", () => {
    test("does not modify trailing whitespace inside <pre>", () => {
      const input = "<pre>\n  code   \n  more   \n</pre>"
      const expected = "<pre>\n  code   \n  more   \n</pre>"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("does not modify trailing whitespace inside <textarea>", () => {
      const input = "<textarea>\n  text   \n  more   \n</textarea>"
      const expected = "<textarea>\n  text   \n  more   \n</textarea>"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("does not modify trailing whitespace inside <script>", () => {
      const input = "<script>\n  const x = 1;   \n  const y = 2;   \n</script>"
      const expected = "<script>\n  const x = 1;   \n  const y = 2;   \n</script>"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("does not modify trailing whitespace inside <style>", () => {
      const input = "<style>\n  .class {   \n    color: red;   \n  }   \n</style>"
      const expected = "<style>\n  .class {   \n    color: red;   \n  }   \n</style>"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("fixes trailing whitespace outside skip elements while preserving inside", () => {
      const input = "<div>   \n<pre>\n  code   \n</pre>\n</div>"
      const expected = "<div>\n<pre>\n  code   \n</pre>\n</div>"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })
  })

  describe("ERB tags", () => {
    test("removes trailing whitespace after ERB comment", () => {
      const input = "<%# comment %>   "
      const expected = "<%# comment %>"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
    })

    test("removes trailing whitespace after ERB output tag", () => {
      const input = "<%= content %>   "
      const expected = "<%= content %>"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
    })

    test("removes trailing whitespace after ERB execution tag", () => {
      const input = "<% code %>   "
      const expected = "<% code %>"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
    })

    test("does not modify trailing whitespace inside multi-line ERB blocks", () => {
      const input = "<%\n  code   \n%>"
      const expected = "<%\n  code   \n%>"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
    })

    test("removes trailing whitespace after ERB if/end blocks", () => {
      const input = "<% if condition %>   \n  content\n<% end %>   "
      const expected = "<% if condition %>\n  content\n<% end %>"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(2)
    })

    test("does not modify ERB inside skip elements", () => {
      const input = "<pre><%= code %>   </pre>"
      const expected = "<pre><%= code %>   </pre>"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
    })

    test("preserves space between ERB tags on same line", () => {
      const input = "<%= a %> <%= b %>"
      const expected = "<%= a %> <%= b %>"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
    })
  })

  describe("ERBLint compatibility", () => {
    test("perfect line remains unchanged", () => {
      const input = "a perfect line\n"
      const expected = "a perfect line\n"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
    })

    test("removes trailing spaces at end of file (no newline)", () => {
      const input = "a not so perfect line   "
      const expected = "a not so perfect line"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
    })

    test("removes trailing spaces before newline", () => {
      const input = "a not so perfect line   \n"
      const expected = "a not so perfect line\n"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
    })

    test("removes tabs and mixed whitespace before newline", () => {
      const input = "a not so perfect line \t\r\t \n"
      const expected = "a not so perfect line\n"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
    })

    test("removes spaces alone on a line", () => {
      const input = "a line\n      \nanother line\n"
      const expected = "a line\n\nanother line\n"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
    })
  })

  describe("HTML comments", () => {
    test("removes trailing whitespace in multiline HTML comments", () => {
      const input = "<!-- comment with trailing space \n   and more content -->"
      const expected = "<!-- comment with trailing space\n   and more content -->"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("does not modify single-line HTML comment without trailing whitespace", () => {
      const input = "<!-- comment -->"
      const expected = "<!-- comment -->"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("removes trailing whitespace on multiple lines in HTML comments", () => {
      const input = "<!--  \n comment  \n -->"
      const expected = "<!--\n comment\n -->"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(2)
      expect(result.unfixed).toHaveLength(0)
    })
  })
})
