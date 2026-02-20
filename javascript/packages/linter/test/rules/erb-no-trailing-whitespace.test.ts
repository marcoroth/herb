import dedent from "dedent"
import { describe, test } from "vitest"

import { createLinterTest } from "../helpers/linter-test-helper.js"
import { ERBNoTrailingWhitespaceRule } from "../../src/rules/erb-no-trailing-whitespace.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoTrailingWhitespaceRule)

describe("erb-no-trailing-whitespace", () => {
  describe("basic trailing whitespace detection", () => {
    test("when empty string", () => {
      expectNoOffenses("")
    })

    test("when no trailing whitespace", () => {
      expectNoOffenses(dedent`
        <div>
          <p>Hello</p>
        </div>
      `)
    })

    test("with leading whitespace", () => {
      expectNoOffenses("  <div>Hello</div>")
    })

    test("with trailing spaces", () => {
      expectError("Extra whitespace detected at end of line.", [1, 5])

      assertOffenses("Hello   ")
    })

    test("with trailing tab", () => {
      expectError("Extra whitespace detected at end of line.", [1, 5])

      assertOffenses("Hello\t")
    })

    test("handles multiple lines", () => {
      expectError("Extra whitespace detected at end of line.", [1, 5])
      expectError("Extra whitespace detected at end of line.", [2, 5])

      assertOffenses("Hello \nWorld \nClean")
    })

    test("when a line has only whitespace", () => {
      expectError("Extra whitespace detected at end of line.", [2, 0])

      assertOffenses("<div>\n   \n</div>")
    })

    test("with trailing whitespace after HTML tag", () => {
      expectError("Extra whitespace detected at end of line.", [1, 16])

      assertOffenses("<div>Hello</div>  ")
    })

    test("with trailing whitespace after ERB tag", () => {
      expectError("Extra whitespace detected at end of line.", [1, 14])

      assertOffenses("<%= content %> ")
    })

    test("detects mixed whitespace", () => {
      expectError("Extra whitespace detected at end of line.", [1, 5])

      assertOffenses("Hello \t ")
    })
  })

  describe("skipping special elements", () => {
    test("ignores trailing whitespace inside <pre> tags", () => {
      expectNoOffenses("<pre>code with trailing spaces   </pre>")
    })

    test("ignores trailing whitespace inside <textarea> tags", () => {
      expectNoOffenses("<textarea>text with trailing spaces   </textarea>")
    })

    test("ignores trailing whitespace inside <script> tags", () => {
      expectNoOffenses("<script>const x = 1;   </script>")
    })

    test("ignores trailing whitespace inside <style> tags", () => {
      expectNoOffenses("<style>.class { color: red; }   </style>")
    })

    test("ignores trailing whitespace on multiple lines inside <pre>", () => {
      expectNoOffenses("<pre>\n  code   \n  more   \n</pre>")
    })

    test("ignores trailing whitespace on multiple lines inside <textarea>", () => {
      expectNoOffenses("<textarea>\n  text   \n  more   \n</textarea>")
    })

    test("ignores trailing whitespace on multiple lines inside <script>", () => {
      expectNoOffenses("<script>\n  const x = 1;   \n  const y = 2;   \n</script>")
    })

    test("ignores trailing whitespace on multiple lines inside <style>", () => {
      expectNoOffenses("<style>\n  .class {   \n    color: red;   \n  }   \n</style>")
    })

    test("detects trailing whitespace outside <pre> but not inside", () => {
      expectError("Extra whitespace detected at end of line.", [1, 5])

      assertOffenses("<div>   \n<pre>\n  code   \n</pre>\n</div>")
    })

    test("detects trailing whitespace after closing special tags", () => {
      expectError("Extra whitespace detected at end of line.", [1, 20])

      assertOffenses("<pre>  code   </pre>  ")
    })

    test("handles multiple skip elements", () => {
      expectNoOffenses("<pre>code   </pre>\n<textarea>text   </textarea>")
    })
  })

  describe("ERB tags", () => {
    test("flags trailing whitespace after ERB comment", () => {
      expectError("Extra whitespace detected at end of line.", [1, 14])

      assertOffenses("<%# comment %>   ")
    })

    test("flags trailing whitespace after ERB output tag", () => {
      expectError("Extra whitespace detected at end of line.", [1, 14])

      assertOffenses("<%= content %>   ")
    })

    test("flags trailing whitespace after ERB execution tag", () => {
      expectError("Extra whitespace detected at end of line.", [1, 10])

      assertOffenses("<% code %>   ")
    })

    test("flags trailing whitespace after last ERB tag on line", () => {
      expectError("Extra whitespace detected at end of line.", [1, 17])

      assertOffenses("<%= a %> <%= b %>   ")
    })

    test("does not flag space between ERB tags on same line", () => {
      expectNoOffenses("<%= a %> <%= b %>")
    })

    test("does not flag trailing whitespace inside multi-line ERB blocks", () => {
      expectNoOffenses("<%\n  code   \n%>")
    })

    test("does not flag trailing whitespace inside multi-line ERB if blocks", () => {
      expectNoOffenses("<% if \n   true %>\n\n<% end %>")
    })

    test("does not flag ERB inside skip elements", () => {
      expectNoOffenses("<pre><%= code %>   </pre>")
    })

    test("does not flag ERB inside multiline skip elements", () => {
      expectNoOffenses("<script>\n  var x = <%= value %>   \n</script>")
    })

    test("flags trailing whitespace after ERB if/end blocks", () => {
      expectError("Extra whitespace detected at end of line.", [1, 18])
      expectError("Extra whitespace detected at end of line.", [3, 9])

      assertOffenses("<% if condition %>   \n  content\n<% end %>   ")
    })
  })

  describe("ERBLint compatibility", () => {
    test("no trailing space - perfect line with newline", () => {
      expectNoOffenses("a perfect line\n")
    })

    test("trailing space at end of file (no newline)", () => {
      expectError("Extra whitespace detected at end of line.", [1, 21])

      assertOffenses("a not so perfect line   ")
    })

    test("trailing space before newline", () => {
      expectError("Extra whitespace detected at end of line.", [1, 21])

      assertOffenses("a not so perfect line   \n")
    })

    test("tabs and mixed whitespace before newline", () => {
      expectError("Extra whitespace detected at end of line.", [1, 21])

      assertOffenses("a not so perfect line \t\r\t \n")
    })

    test("spaces alone on a line", () => {
      expectError("Extra whitespace detected at end of line.", [2, 0])

      assertOffenses("a line\n      \nanother line\n")
    })
  })

  describe("spacing between elements", () => {
    test("does not flag space between HTML tag and ERB comment on same line", () => {
      expectNoOffenses("<DIV>hello</DIV> <%# herb:disable html-tag-name-lowercase %>")
    })

    test("does not flag space between ERB tags on same line", () => {
      expectNoOffenses("<% %> <%# herb:disable erb-no-empty-tags %>")
    })

    test("does not flag space between HTML elements on same line", () => {
      expectNoOffenses("<span>Hello</span> <span>World</span>")
    })

    test("does not flag space between ERB output and HTML on same line", () => {
      expectNoOffenses("<%= content %> <span>text</span>")
    })

    test("does not flag multiple spaces between elements on same line", () => {
      expectNoOffenses("<div>Hello</div>   <p>World</p>")
    })

    test("does not flag tab between elements on same line", () => {
      expectNoOffenses("<div>Hello</div>\t<p>World</p>")
    })
  })

  describe("ERB control flow nodes", () => {
    test("does not flag trailing whitespace inside multi-line ERBContentNode", () => {
      expectNoOffenses("<%\n  code   \n%>")
    })

    test("does not flag trailing whitespace inside multi-line ERBIfNode", () => {
      expectNoOffenses("<% if \n   condition   %>\n  content\n<% end %>")
    })

    test("does not flag trailing whitespace inside multi-line ERBUnlessNode", () => {
      expectNoOffenses("<% unless \n   condition   %>\n  content\n<% end %>")
    })

    test("does not flag trailing whitespace inside multi-line ERBBlockNode", () => {
      expectNoOffenses("<% items.each do |item|   \n%>\n  content\n<% end %>")
    })

    test("does not flag trailing whitespace inside multi-line ERBCaseNode", () => {
      expectNoOffenses("<% case \n   value   %>\n<% when 1 %>\n  content\n<% end %>")
    })

    test("does not flag trailing whitespace inside multi-line ERBWhileNode", () => {
      expectNoOffenses("<% while \n   condition   %>\n  content\n<% end %>")
    })

    test("does not flag trailing whitespace inside multi-line ERBUntilNode", () => {
      expectNoOffenses("<% until \n   condition   %>\n  content\n<% end %>")
    })

    test("does not flag trailing whitespace inside multi-line ERBForNode", () => {
      expectNoOffenses("<% for item in \n   items   %>\n  content\n<% end %>")
    })

    test("does not flag trailing whitespace inside multi-line ERBBeginNode", () => {
      expectNoOffenses("<% begin   \n%>\n  content\n<% rescue %>\n  error\n<% end %>")
    })

    test("does not flag trailing whitespace inside multi-line ERBElseNode", () => {
      expectNoOffenses("<% if condition %>\n  true_content\n<% else   \n%>\n  false_content\n<% end %>")
    })

    test("does not flag trailing whitespace inside multi-line ERBWhenNode", () => {
      expectNoOffenses("<% case value %>\n<% when \n   1   %>\n  content\n<% end %>")
    })

    test("does not flag trailing whitespace inside multi-line ERBRescueNode", () => {
      expectNoOffenses("<% begin %>\n  content\n<% rescue \n   StandardError   %>\n  error\n<% end %>")
    })

    test("does not flag trailing whitespace inside multi-line ERBEnsureNode", () => {
      expectNoOffenses("<% begin %>\n  content\n<% ensure   \n%>\n  cleanup\n<% end %>")
    })

    test("does not flag trailing whitespace inside multi-line ERBEndNode", () => {
      expectNoOffenses("<% if condition %>\n  content\n<% end   \n%>")
    })

    test("does not flag trailing whitespace inside ERB output tag spanning lines", () => {
      expectNoOffenses("<%= long_method_call(\n   argument   \n) %>")
    })

    test("does not flag trailing whitespace inside ERB comment spanning lines", () => {
      expectNoOffenses("<%# This is a \n   long comment   %>")
    })
  })

  describe("HTML comments", () => {
    test("does not flag single-line HTML comment without trailing whitespace", () => {
      expectNoOffenses('<!-- Multiple offenses of same rules to test "Most frequent rule offenses" display -->')
    })

    test("flags trailing whitespace in multiline HTML comments", () => {
      expectError("Extra whitespace detected at end of line.", [1, 32])

      assertOffenses("<!-- comment with trailing space \n   and more content -->")
    })

    test("does not flag HTML comment at end of file without trailing whitespace", () => {
      expectNoOffenses("<!-- comment -->")
    })

    test("flags trailing whitespace on multiple lines in HTML comments", () => {
      expectError("Extra whitespace detected at end of line.", [1, 4])
      expectError("Extra whitespace detected at end of line.", [2, 8])

      assertOffenses("<!--  \n comment  \n -->")
    })
  })
})
