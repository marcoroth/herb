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

    test("preserves whitespace in <code> tags", () => {
      const template = dedent`
        <div>
          <code>const x = 1
          const y = 2</code>
        </div>
      `
      const result = minifier.minifyString(template)

      expect(result).toBe(dedent`
        <div><code>const x = 1
          const y = 2</code></div>
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
