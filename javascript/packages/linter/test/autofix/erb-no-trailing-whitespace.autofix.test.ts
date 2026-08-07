import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { createAutofixTest } from "../helpers/autofix-test-helper.js"

import { ERBNoTrailingWhitespaceRule } from "../../src/rules/erb-no-trailing-whitespace.js"

describe("erb-no-trailing-whitespace autofix", () => {
  const { autofix } = createAutofixTest(ERBNoTrailingWhitespaceRule)

  beforeAll(async () => {
    await Herb.load()
  })

  test("removes trailing spaces", () => {
    const input = "Hello   "
    const expected = "Hello"

    const result = autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("removes trailing tab", () => {
    const input = "Hello\t"
    const expected = "Hello"

    const result = autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("removes all occurrences of trailing whitespace", () => {
    const input = "Hello \nWorld \nClean"
    const expected = "Hello\nWorld\nClean"

    const result = autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("removes whitespace-only content from blank lines", () => {
    const input = "<div>\n   \n</div>"
    const expected = "<div>\n\n</div>"

    const result = autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("removes trailing whitespace after HTML tags", () => {
    const input = "<div>Hello</div>  \n<p>World</p>"
    const expected = "<div>Hello</div>\n<p>World</p>"

    const result = autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("handles mixed whitespace", () => {
    const input = "Hello \t "
    const expected = "Hello"

    const result = autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not modify file without trailing whitespace", () => {
    const input = "<div>\n  <p>Hello</p>\n</div>"
    const expected = "<div>\n  <p>Hello</p>\n</div>"

    const result = autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("handles empty file", () => {
    const input = ""
    const expected = ""

    const result = autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("preserves indentation while removing trailing whitespace", () => {
    const input = "  <div> \n    <p>Hello</p> \n  </div>"
    const expected = "  <div>\n    <p>Hello</p>\n  </div>"

    const result = autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("preserves newlines while removing trailing whitespace", () => {
    const input = "Hello \n\nWorld \n"
    const expected = "Hello\n\nWorld\n"

    const result = autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  describe("skip elements", () => {
    test("does not modify trailing whitespace inside <pre>", () => {
      const input = "<pre>\n  code   \n  more   \n</pre>"
      const expected = "<pre>\n  code   \n  more   \n</pre>"

      const result = autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("does not modify trailing whitespace inside <textarea>", () => {
      const input = "<textarea>\n  text   \n  more   \n</textarea>"
      const expected = "<textarea>\n  text   \n  more   \n</textarea>"

      const result = autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("does not modify trailing whitespace inside <script>", () => {
      const input = "<script>\n  const x = 1;   \n  const y = 2;   \n</script>"
      const expected = "<script>\n  const x = 1;   \n  const y = 2;   \n</script>"

      const result = autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("does not modify trailing whitespace inside <style>", () => {
      const input = "<style>\n  .class {   \n    color: red;   \n  }   \n</style>"
      const expected = "<style>\n  .class {   \n    color: red;   \n  }   \n</style>"

      const result = autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("fixes trailing whitespace outside skip elements while preserving inside", () => {
      const input = "<div>   \n<pre>\n  code   \n</pre>\n</div>"
      const expected = "<div>\n<pre>\n  code   \n</pre>\n</div>"

      const result = autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })
  })

  describe("ERB tags", () => {
    test("removes trailing whitespace after ERB comment", () => {
      const input = "<%# comment %>   "
      const expected = "<%# comment %>"

      const result = autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
    })

    test("removes trailing whitespace after ERB output tag", () => {
      const input = "<%= content %>   "
      const expected = "<%= content %>"

      const result = autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
    })

    test("removes trailing whitespace after ERB execution tag", () => {
      const input = "<% code %>   "
      const expected = "<% code %>"

      const result = autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
    })

    test("does not modify trailing whitespace inside multi-line ERB blocks", () => {
      const input = "<%\n  code   \n%>"
      const expected = "<%\n  code   \n%>"

      const result = autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
    })

    test("removes trailing whitespace after ERB if/end blocks", () => {
      const input = "<% if condition %>   \n  content\n<% end %>   "
      const expected = "<% if condition %>\n  content\n<% end %>"

      const result = autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(2)
    })

    test("does not modify ERB inside skip elements", () => {
      const input = "<pre><%= code %>   </pre>"
      const expected = "<pre><%= code %>   </pre>"

      const result = autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
    })

    test("preserves space between ERB tags on same line", () => {
      const input = "<%= a %> <%= b %>"
      const expected = "<%= a %> <%= b %>"

      const result = autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
    })
  })

  describe("ERBLint compatibility", () => {
    test("perfect line remains unchanged", () => {
      const input = "a perfect line\n"
      const expected = "a perfect line\n"

      const result = autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
    })

    test("removes trailing spaces at end of file (no newline)", () => {
      const input = "a not so perfect line   "
      const expected = "a not so perfect line"

      const result = autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
    })

    test("removes trailing spaces before newline", () => {
      const input = "a not so perfect line   \n"
      const expected = "a not so perfect line\n"

      const result = autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
    })

    test("removes tabs and mixed whitespace before newline", () => {
      const input = "a not so perfect line \t\r\t \n"
      const expected = "a not so perfect line\n"

      const result = autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
    })

    test("removes spaces alone on a line", () => {
      const input = "a line\n      \nanother line\n"
      const expected = "a line\n\nanother line\n"

      const result = autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
    })
  })

  describe("HTML comments", () => {
    test("removes trailing whitespace in multiline HTML comments", () => {
      const input = "<!-- comment with trailing space \n   and more content -->"
      const expected = "<!-- comment with trailing space\n   and more content -->"

      const result = autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("does not modify single-line HTML comment without trailing whitespace", () => {
      const input = "<!-- comment -->"
      const expected = "<!-- comment -->"

      const result = autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("removes trailing whitespace on multiple lines in HTML comments", () => {
      const input = "<!--  \n comment  \n -->"
      const expected = "<!--\n comment\n -->"

      const result = autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(2)
      expect(result.unfixed).toHaveLength(0)
    })
  })

  describe("inside tags", () => {
    test("removes trailing whitespace between attributes", () => {
      const input = '<div data-a="foo" \n  data-b="bar">\nlorem\n</div>\n'
      const expected = '<div data-a="foo"\n  data-b="bar">\nlorem\n</div>\n'

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("removes trailing whitespace after tag name", () => {
      const input = '<div \n  data-b="bar">\nlorem\n</div>\n'
      const expected = '<div\n  data-b="bar">\nlorem\n</div>\n'

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("removes trailing whitespace before the tag closing", () => {
      const input = '<div data-a="foo"  \n>\nlorem\n</div>\n'
      const expected = '<div data-a="foo"\n>\nlorem\n</div>\n'

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("removes trailing whitespace inside a closing tag", () => {
      const input = "<div>\nlorem\n</div \n>\n"
      const expected = "<div>\nlorem\n</div\n>\n"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("removes trailing whitespace inside a self-closing tag", () => {
      const input = '<img src="a.png" \n  alt="x" />\n'
      const expected = '<img src="a.png"\n  alt="x" />\n'

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("removes mixed trailing whitespace between attributes", () => {
      const input = '<div data-a="foo" \t \n  data-b="bar">\nlorem\n</div>\n'
      const expected = '<div data-a="foo"\n  data-b="bar">\nlorem\n</div>\n'

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("preserves whitespace between attributes on the same line", () => {
      const input = '        <div     data-a="foo" \n                   data-b="bar">\n        lorem\n        </div>\n'
      const expected = '        <div     data-a="foo"\n                   data-b="bar">\n        lorem\n        </div>\n'

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("does not modify trailing whitespace inside a skipped element's tag", () => {
      const input = '<pre data-a="foo" \n  data-b="bar">\nlorem\n</pre>\n'

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(input)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("fixes every trailing whitespace occurrence inside a multi-line tag", () => {
      const input = '<div \n  data-a="foo" \n  data-b="bar" \n>\nlorem\n</div>\n'
      const expected = '<div\n  data-a="foo"\n  data-b="bar"\n>\nlorem\n</div>\n'

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(3)
      expect(result.unfixed).toHaveLength(0)
    })

    test("leaves no offenses behind after fixing", () => {
      const input = '<div data-a="foo" \n  data-b="bar">\nlorem  \n</div>\n'

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(linter.lint(result.source, { fileName: "test.html.erb" }).offenses).toHaveLength(0)
    })

    test("removes trailing whitespace after a valueless attribute", () => {
      const input = "<input disabled \n  required>\n"
      const expected = "<input disabled\n  required>\n"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("removes trailing whitespace after an unquoted attribute value", () => {
      const input = "<div class=foo \n  id=bar>\ny\n</div>\n"
      const expected = "<div class=foo\n  id=bar>\ny\n</div>\n"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("removes trailing whitespace after a single-quoted attribute value", () => {
      const input = "<div class='foo' \n  id='bar'>\ny\n</div>\n"
      const expected = "<div class='foo'\n  id='bar'>\ny\n</div>\n"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("removes trailing whitespace inside a void element tag", () => {
      const input = "<br \n>\n"
      const expected = "<br\n>\n"

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("removes trailing whitespace before a self-closing slash", () => {
      const input = '<img src="a.png" \n/>\n'
      const expected = '<img src="a.png"\n/>\n'

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("removes a trailing tab between attributes", () => {
      const input = '<div data-a="foo"\t\n  data-b="bar">\ny\n</div>\n'
      const expected = '<div data-a="foo"\n  data-b="bar">\ny\n</div>\n'

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("removes a trailing vertical tab and form feed between attributes", () => {
      const input = '<div data-a="foo"\v\n  data-b="bar"\f\n  data-c="baz">\ny\n</div>\n'
      const expected = '<div data-a="foo"\n  data-b="bar"\n  data-c="baz">\ny\n</div>\n'

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(2)
      expect(result.unfixed).toHaveLength(0)
    })

    test("fixes nested elements that both have multi-line tags", () => {
      const input = '<div \n  id="a">\n  <span \n    id="b">x</span>\n</div>\n'
      const expected = '<div\n  id="a">\n  <span\n    id="b">x</span>\n</div>\n'

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(2)
      expect(result.unfixed).toHaveLength(0)
    })

    test("fixes trailing whitespace inside a tag and in text content together", () => {
      const input = '<div id="a" \n  class="b">\nlorem  \n</div>\n'
      const expected = '<div id="a"\n  class="b">\nlorem\n</div>\n'

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(2)
      expect(result.unfixed).toHaveLength(0)
    })

    test("does not introduce parse errors", () => {
      const input = '<div     data-a="foo" \n                   data-b="bar">\n        lorem\n        </div>\n'

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const result = linter.autofix(input, { fileName: "test.html.erb" })

      expect(Herb.parse(result.source).value.recursiveErrors()).toHaveLength(0)
    })

    test("is idempotent", () => {
      const input = '<div \n  data-a="foo" \n  data-b="bar" \n>\nlorem  \n</div>\n'

      const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
      const once = linter.autofix(input, { fileName: "test.html.erb" })
      const twice = linter.autofix(once.source, { fileName: "test.html.erb" })

      expect(twice.source).toBe(once.source)
      expect(twice.fixed).toHaveLength(0)
    })

    describe("ERB", () => {
      test("removes trailing whitespace after an attribute with an ERB value", () => {
        const input = '<div class="<%= foo %>" \n  id="x">\ny\n</div>\n'
        const expected = '<div class="<%= foo %>"\n  id="x">\ny\n</div>\n'

        const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
        const result = linter.autofix(input, { fileName: "test.html.erb" })

        expect(result.source).toBe(expected)
        expect(result.fixed).toHaveLength(1)
        expect(result.unfixed).toHaveLength(0)
      })

      test("removes trailing whitespace after ERB in attribute position", () => {
        const input = '<div <%= attributes %> \n  data-b="x">\ny\n</div>\n'
        const expected = '<div <%= attributes %>\n  data-b="x">\ny\n</div>\n'

        const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
        const result = linter.autofix(input, { fileName: "test.html.erb" })

        expect(result.source).toBe(expected)
        expect(result.fixed).toHaveLength(1)
        expect(result.unfixed).toHaveLength(0)
      })

      test("removes trailing whitespace after ERB control flow inside a tag", () => {
        const input = '<div <% if condition %> \n  data-a="1" <% end %>>\ny\n</div>\n'
        const expected = '<div <% if condition %>\n  data-a="1" <% end %>>\ny\n</div>\n'

        const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
        const result = linter.autofix(input, { fileName: "test.html.erb" })

        expect(result.source).toBe(expected)
        expect(result.fixed).toHaveLength(1)
        expect(result.unfixed).toHaveLength(0)
      })
    })

    describe("whitespace significant elements", () => {
      test("does not modify the open tag of a <textarea>", () => {
        const input = '<textarea rows="2" \n  cols="3">\nx  \n</textarea>\n'

        const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
        const result = linter.autofix(input, { fileName: "test.html.erb" })

        expect(result.source).toBe(input)
        expect(result.fixed).toHaveLength(0)
        expect(result.unfixed).toHaveLength(0)
      })

      test("does not modify the open tag of a <script>", () => {
        const input = '<script type="text/javascript" \n  defer>\nvar x = 1;  \n</script>\n'

        const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
        const result = linter.autofix(input, { fileName: "test.html.erb" })

        expect(result.source).toBe(input)
        expect(result.fixed).toHaveLength(0)
        expect(result.unfixed).toHaveLength(0)
      })

      test("does not modify the open tag of a <style>", () => {
        const input = '<style media="all" \n  scoped>\n.a { }  \n</style>\n'

        const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
        const result = linter.autofix(input, { fileName: "test.html.erb" })

        expect(result.source).toBe(input)
        expect(result.fixed).toHaveLength(0)
        expect(result.unfixed).toHaveLength(0)
      })
    })

    describe("pathological input", () => {
      test("handles a long run of trailing whitespace inside a tag", () => {
        const input = '<div data-a="foo"' + "\t".repeat(50_000) + '\n  data-b="bar">\ny\n</div>\n'
        const expected = '<div data-a="foo"\n  data-b="bar">\ny\n</div>\n'

        const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
        const result = linter.autofix(input, { fileName: "test.html.erb" })

        expect(result.source).toBe(expected)
        expect(result.fixed).toHaveLength(1)
        expect(result.unfixed).toHaveLength(0)
      })
    })

    describe("line endings", () => {
      test("strips carriage returns inside tags and text alike", () => {
        const input = '<div data-a="foo"\r\n  data-b="bar">\r\nlorem\r\n</div>\r\n'
        const expected = '<div data-a="foo"\n  data-b="bar">\nlorem\n</div>\n'

        const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
        const result = linter.autofix(input, { fileName: "test.html.erb" })

        expect(result.source).toBe(expected)
        expect(result.fixed).toHaveLength(4)
        expect(result.unfixed).toHaveLength(0)
      })
    })
  })
})
