import { describe, test, expect, beforeAll, beforeEach } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Highlighter } from "../src/highlighter.js"

const PATH = "app/views/users/show.html.erb"

describe("HTMLSink", () => {
  let highlighter: Highlighter

  beforeAll(async () => {
    await Herb.load()
  })

  beforeEach(async () => {
    highlighter = new Highlighter("onedark")
    await highlighter.initialize()
  })

  test("renders a file fragment with line numbers", () => {
    const content = "<div>\n  <!-- first comment line\n  second comment line -->\n  <span>ok</span>\n</div>"
    const result = highlighter.highlightHTML(PATH, content)

    expect(result).toMatchSnapshot()
  })

  test("escapes HTML metacharacters", () => {
    const content = "<div data-x=\"a&b\"><%= a < b && b > \"c\" %>'quoted'</div>"
    const result = highlighter.highlightHTML(PATH, content)

    expect(result).toMatchSnapshot()
  })

  test("renders a plain fragment without line numbers", () => {
    const content = "<div>hello</div>\n<span>world</span>"
    const result = highlighter.highlightHTML(PATH, content, { showLineNumbers: false })

    expect(result).toMatchSnapshot()
  })

  test("renders a focus fragment with dimmed context", () => {
    const content = "<div>\n  <p>one</p>\n  <p>two</p>\n  <p>three</p>\n</div>"
    const result = highlighter.highlightHTML(PATH, content, { focusLine: 3, contextLines: 1 })

    expect(result).toMatchSnapshot()
  })

  test("renders an empty file as a single empty line", () => {
    const result = highlighter.highlightHTML(PATH, "")

    const expected = [
      "<figure class=\"herb-highlight\" data-herb-theme=\"onedark\">",
      "<figcaption class=\"herb-file-header\">app/views/users/show.html.erb</figcaption>",
      "<pre class=\"herb-code\"><code><span class=\"herb-line\" data-line=\"1\"></span></code></pre>",
      "</figure>",
    ].join("\n")

    expect(result).toBe(expected)
  })

  test("focus beyond the last line renders an empty window", () => {
    const result = highlighter.highlightHTML(PATH, "a\nb", { focusLine: 10, contextLines: 1 })

    const expected = [
      "<figure class=\"herb-highlight\" data-herb-theme=\"onedark\">",
      "<figcaption class=\"herb-file-header\">app/views/users/show.html.erb</figcaption>",
      "<pre class=\"herb-code\"><code></code></pre>",
      "</figure>",
    ].join("\n")

    expect(result).toBe(expected)
  })
})
