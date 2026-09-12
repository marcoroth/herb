import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { IdentityPrinter } from "@herb-tools/printer"
import { Minifier, minify } from "../src/index.js"

describe("Minifier", () => {
  let minifier: Minifier

  beforeAll(async () => {
    minifier = new Minifier(Herb)
    await minifier.initialize()
  })

  describe("top-level minify function", () => {
    test("minify", () => {
      const template = `<div>  <span>Hello</span>  </div>`
      const parseResult = Herb.parse(template)

      const { output, node } = minify(parseResult.value)

      expect(output).toBe(`<div><span>Hello</span></div>`)
      expect(IdentityPrinter.print(node)).toBe(`<div><span>Hello</span></div>`)
    })
  })

  describe("basic minification", () => {
    test("removes whitespace between tags", () => {
      const template = `<div>  <span>Hello</span>  </div>`
      const result = minifier.minifyString(template)

      expect(result).toBe(`<div><span>Hello</span></div>`)
    })

    test("collapses multiple spaces to single space in text", () => {
      const template = `<div>Hello    World</div>`
      const result = minifier.minifyString(template)

      expect(result).toBe(`<div>Hello World</div>`)
    })

    test("removes newlines and indentation", () => {
      const template = dedent`
        <div class="container">
          <h1>Hello World</h1>
          <p>This is a test</p>
        </div>
      `
      const result = minifier.minifyString(template)

      expect(result).toBe(`<div class="container"><h1>Hello World</h1><p>This is a test</p></div>`)
    })

    test("handles nested elements", () => {
      const template = dedent`
        <div>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
            <li>Item 3</li>
          </ul>
        </div>
      `
      const result = minifier.minifyString(template)

      expect(result).toBe(`<div><ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul></div>`)
    })
  })

  describe("whitespace between elements", () => {
    test("keeps the space between text and a following inline element", () => {
      expect(minifier.minifyString(`<div>Hello <b>world</b></div>`)).toBe(`<div>Hello <b>world</b></div>`)
    })

    test("keeps the space between an inline element and following text", () => {
      expect(minifier.minifyString(`<div><b>Hello</b> world</div>`)).toBe(`<div><b>Hello</b> world</div>`)
    })

    test("keeps the space between two inline elements", () => {
      expect(minifier.minifyString(`<p><span>a</span> <span>b</span></p>`)).toBe(`<p><span>a</span> <span>b</span></p>`)
    })

    test("collapses a run of whitespace between two inline elements to one space", () => {
      expect(minifier.minifyString(`<p><span>a</span>   \n   <span>b</span></p>`)).toBe(`<p><span>a</span> <span>b</span></p>`)
    })

    test("keeps the spaces around an inline element inside a sentence", () => {
      expect(minifier.minifyString(`<p>one <a href="/x">two</a> three</p>`)).toBe(`<p>one <a href="/x">two</a> three</p>`)
    })

    test("drops the whitespace between two block elements", () => {
      expect(minifier.minifyString(`<div><p>a</p>   <p>b</p></div>`)).toBe(`<div><p>a</p><p>b</p></div>`)
    })

    test("drops the whitespace between text and a following block element", () => {
      expect(minifier.minifyString(`<div>Hello <p>world</p></div>`)).toBe(`<div>Hello<p>world</p></div>`)
    })

    test("drops the leading and trailing whitespace of a block", () => {
      expect(minifier.minifyString(`<div>  Hello  </div>`)).toBe(`<div>Hello</div>`)
    })

    test("keeps the space between text and a void inline element", () => {
      expect(minifier.minifyString(`<div>Hello <img src="x.png"> world</div>`)).toBe(`<div>Hello <img src="x.png"> world</div>`)
    })
  })

  describe("preserve whitespace in special tags", () => {
    test("preserves whitespace in <pre> tags", () => {
      const template = dedent`
        <div>
          <pre>
            Line 1
              Line 2
                Line 3
          </pre>
        </div>
      `
      const result = minifier.minifyString(template)

      expect(result).toBe(dedent`
        <div><pre>
            Line 1
              Line 2
                Line 3
          </pre></div>
      `)
    })

    test("collapses whitespace in <code> tags, which render with `white-space: normal`", () => {
      const template = dedent`
        <div>
          <code>const x = 1
          const y = 2</code>
        </div>
      `
      const result = minifier.minifyString(template)

      expect(result).toBe(`<div><code>const x = 1 const y = 2</code></div>`)
    })

    test("preserves whitespace in <textarea> tags", () => {
      const template = dedent`
        <div>
          <textarea>
        line 1
          line 2
        </textarea>
        </div>
      `
      const result = minifier.minifyString(template)

      expect(result).toBe(dedent`
        <div><textarea>
        line 1
          line 2
        </textarea></div>
      `)
    })

    test("preserves whitespace in <script> tags", () => {
      const template = dedent`
        <div>
          <script>
            // a comment
            const x = 1
          </script>
        </div>
      `
      const result = minifier.minifyString(template)

      expect(result).toBe(dedent`
        <div><script>
            // a comment
            const x = 1
          </script></div>
      `)
    })

    test("preserves whitespace in <style> tags", () => {
      const template = dedent`
        <div>
          <style>
            .a { color: red }
          </style>
        </div>
      `
      const result = minifier.minifyString(template)

      expect(result).toBe(dedent`
        <div><style>
            .a { color: red }
          </style></div>
      `)
    })

    test("handles nested preserve-whitespace tags", () => {
      const template = dedent`
        <div>
          <pre>
            <code>
              function test() {
                return true
              }
            </code>
          </pre>
        </div>
      `
      const result = minifier.minifyString(template)

      expect(result).toBe(dedent`
        <div><pre>
            <code>
              function test() {
                return true
              }
            </code>
          </pre></div>
      `)
    })
  })

  describe("attributes", () => {
    test("preserves attributes", () => {
      const template = `<div class="container" id="main">Content</div>`
      const result = minifier.minifyString(template)

      expect(result).toBe(`<div class="container" id="main">Content</div>`)
    })

    test("handles self-closing tags", () => {
      const template = `<div><img src="test.jpg" /></div>`
      const result = minifier.minifyString(template)

      expect(result).toBe(`<div><img src="test.jpg" /></div>`)
    })
  })

  describe("ERB support", () => {
    test("handles ERB output tags", () => {
      const template = dedent`
        <div>
          <%= user.name %>
        </div>
      `
      const result = minifier.minifyString(template)

      expect(result).toBe(`<div><%=user.name%></div>`)
    })

    test("handles ERB conditionals", () => {
      const template = dedent`
        <div>
          <% if admin? %>
            <span>Admin</span>
          <% else %>
            <span>User</span>
          <% end %>
        </div>
      `
      const result = minifier.minifyString(template)

      expect(result).toBe(`<div><%if admin?%><span>Admin</span><%else%><span>User</span><%end%></div>`)
    })

    test("handles ERB output", () => {
      const template = dedent`
        <div> Hello <%= world %> </div>
      `
      const result = minifier.minifyString(template)

      expect(result).toBe(`<div>Hello <%= world %></div>`)
    })

    test("handles ERB output-2", () => {
      const template = dedent`
        <div>   Hello    <%= world %>      </div>
      `
      const result = minifier.minifyString(template)

      expect(result).toBe(`<div>Hello <%=world%></div>`)
    })

    test("handles ERB output-2", () => {
      const template = dedent`
        <div>   Hello    <%= world %>      !</div>
      `
      const result = minifier.minifyString(template)

      expect(result).toBe(`<div>Hello <%=world%> !</div>`)
    })
  })

  describe("HTML attributes", () => {
    test("class", () => {
      const template = `<div     class="  one    two    "     id=" abc "   ></div>`

      const result = minifier.minifyString(template)

      expect(result).toBe(`<div class="one two" id=" abc "></div>`)
    })
    test("class with erb", () => {
      const template = `<div     class="  one    <%= two %>    "     id=" abc "   ></div>`

      const result = minifier.minifyString(template)

      expect(result).toBe(`<div class="one <%= two %>" id=" abc "></div>`)
    })

    test("non-class", () => {
      const template = `<input     value="  one    two    "     id=" input "  />`

      const result = minifier.minifyString(template)

      expect(result).toBe(`<input value="  one    two    " id=" input "/>`)
    })

    test("with newlines", () => {
      const template = dedent`
        <div
          class="
           one   <%= two %>  three
          "
          disabled
        >

          Hello     <%= world %>      !

        </div>
      `

      const result = minifier.minifyString(template)

      expect(result).toBe(`<div class="one <%=two%> three" disabled>Hello <%=world%> !</div>`)
    })

    test("with spaces around =", () => {
      const template = dedent`
        <div class  =  "value"></div>
      `

      const result = minifier.minifyString(template)

      expect(result).toBe(`<div class="value"></div>`)
    })

    test("attribute wrapped in if", () => {
      const template = dedent`
        <div

          <% if valid? %>

            class="
             one   <%= two %>  three
            "


          <% end %>

          disabled
        >

          Hello     <%= world %>      !

        </div>
      `

      const result = minifier.minifyString(template)

      expect(result).toBe(`<div <%if valid?%>class="one <%=two%> three"<%end%> disabled>Hello <%=world%> !</div>`)
    })

    test("two attributes wrapped in if", () => {
      const template = dedent`
        <div

          <% if valid? %>

            class="
             one   <%= two %>  three
            "

            id="one"
          <% end %>

          disabled
        >

          Hello     <%= world %>      !

        </div>
      `

      const result = minifier.minifyString(template)

      expect(result).toBe(`<div <%if valid?%>class="one <%=two%> three" id="one"<%end%> disabled>Hello <%=world%> !</div>`)
    })
  })

  describe("comments", () => {
    test("removes HTML comments", () => {
      expect(minifier.minifyString(`<div><!-- a comment --><p>x</p></div>`)).toBe(`<div><p>x</p></div>`)
    })

    test("removes ERB comments", () => {
      expect(minifier.minifyString(`<div><%# a comment %><p>x</p></div>`)).toBe(`<div><p>x</p></div>`)
    })

    test("removes the whitespace a removed comment leaves behind", () => {
      const template = dedent`
        <div>
          <!-- a comment -->
          <p>x</p>
        </div>
      `

      expect(minifier.minifyString(template)).toBe(`<div><p>x</p></div>`)
    })

    test("collapses the whitespace around a comment between inline elements to one space", () => {
      const template = `<p><span>a</span> <!-- a comment --> <span>b</span></p>`

      expect(minifier.minifyString(template)).toBe(`<p><span>a</span> <span>b</span></p>`)
    })

    test("keeps downlevel-revealed conditional comments", () => {
      const template = `<div><!--[if lt IE 9]><script src="shim.js"></script><![endif]--><p>x</p></div>`

      expect(minifier.minifyString(template)).toBe(`<div><!--[if lt IE 9]><script src="shim.js"></script><![endif]--><p>x</p></div>`)
    })

    test("keeps Herb directives, which reach the minifier as ERB comments", () => {
      const template = `<div><%# herb:state count = 0 %><p>x</p></div>`

      expect(minifier.minifyString(template)).toBe(`<div><%# herb:state count = 0 %><p>x</p></div>`)
    })

    test("removes comments inside inline elements", () => {
      expect(minifier.minifyString(`<span>a<!-- c -->b</span>`)).toBe(`<span>ab</span>`)
    })
  })

  describe("error handling", () => {
    test("returns original template on parse failure", () => {
      const template = `<div class="unclosed`
      const result = minifier.minifyString(template)

      expect(result).toBe(template)
    })
  })

  describe("instance usage", () => {
    test("minifies using instance method", () => {
      const template = dedent`
        <div>
          <h1>Hello World</h1>
        </div>
      `
      const result = minifier.minifyString(template)

      expect(result).toBe(`<div><h1>Hello World</h1></div>`)
    })
  })
})
