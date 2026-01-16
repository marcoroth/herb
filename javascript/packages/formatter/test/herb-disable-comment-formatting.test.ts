import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../src"
import dedent from "dedent"

let formatter: Formatter

describe("herb:disable comment formatting", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80,
    })
  })

  test("should keep herb:disable comment inline after opening tag", () => {
    const source = dedent`
      <DIV> <%# herb:disable html-tag-name-lowercase %>
        Dolores id occaecati ipsam. Eius blanditiis odio quas. Corrupti officia quasi sunt neque soluta veritatis. Sint esse nihil alias quia qui. Aut omnis quia ut dolores reiciendis. Numquam voluptate esse voluptas.
      </DIV> <%# herb:disable html-tag-name-lowercase %>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <DIV> <%# herb:disable html-tag-name-lowercase %>
        Dolores id occaecati ipsam. Eius blanditiis odio quas. Corrupti officia quasi
        sunt neque soluta veritatis. Sint esse nihil alias quia qui. Aut omnis quia
        ut dolores reiciendis. Numquam voluptate esse voluptas.
      </DIV> <%# herb:disable html-tag-name-lowercase %>
    `)
  })

  test("should keep herb:disable comment inline after opening tag nested in other element", () => {
    const source = dedent`
      <div>
        <DIV> <%# herb:disable html-tag-name-lowercase %>
          Dolores id occaecati ipsam. Eius blanditiis odio quas. Corrupti officia quasi sunt neque soluta veritatis. Sint esse nihil alias quia qui. Aut omnis quia ut dolores reiciendis. Numquam voluptate esse voluptas.
        </DIV> <%# herb:disable html-tag-name-lowercase %>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <div>
        <DIV> <%# herb:disable html-tag-name-lowercase %>
          Dolores id occaecati ipsam. Eius blanditiis odio quas. Corrupti officia
          quasi sunt neque soluta veritatis. Sint esse nihil alias quia qui. Aut
          omnis quia ut dolores reiciendis. Numquam voluptate esse voluptas.
        </DIV> <%# herb:disable html-tag-name-lowercase %>
      </div>
    `)
  })

  test("should keep herb:disable comment inline after closing tag", () => {
    const source = dedent`
      <DIV>
        Some content here that needs formatting.
      </DIV> <%# herb:disable html-tag-name-lowercase %>
    `

    const result = formatter.format(source)

    expect(result).toBe(source)
  })

  test("should not count herb:disable comment length in line wrapping calculations", () => {
    const source = dedent`
      <DIV> <%# herb:disable html-tag-name-lowercase, some-super-long-rule-names-that-should-make-this-wrap-but-it-doesnt-because-its-a-herb-disable-comment %>
        Short text here that should not wrap.
      </DIV>
    `

    const result = formatter.format(source)

    expect(result).toBe(source)
  })

  test("should treat herb:disable as 'invisible' for text flow wrapping", () => {
    const source = dedent`
      <p> <%# herb:disable some-rule %>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
      </p>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <p> <%# herb:disable some-rule %>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua.
      </p>
    `)
  })

  test("should handle herb:disable all comment", () => {
    const source = dedent`
      <SPAN> <%# herb:disable all %>
        Some content that needs wrapping because it is quite long and exceeds the line length limit.
      </SPAN>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <SPAN> <%# herb:disable all %>
        Some content that needs wrapping because it is quite long and exceeds the
        line length limit.
      </SPAN>
    `)
  })

  test("should handle multiple rule names in herb:disable comment", () => {
    const source = dedent`
      <DIV> <%# herb:disable rule-one, rule-two, rule-three %>
        Text content here.
      </DIV>
    `

    const result = formatter.format(source)

    expect(result).toBe(source)
  })

  test("should preserve herb:disable comment whitespace and position", () => {
    const source = dedent`
      <DIV><%# herb:disable html-tag-name-lowercase %>
        Content here.
      </DIV>
    `

    const result = formatter.format(source)

    expect(result).toBe(source)
  })

  test("should not treat regular ERB comments as herb:disable", () => {
    const source = dedent`
      <div> <%# just a regular comment %>
        Some text that should wrap normally when it gets very long and exceeds the maximum line length limit.
      </div>
    `

    const result = formatter.format(source)

    expect(result).not.toBe(dedent`
      <div> <%# just a regular comment %>
        Some text that should wrap normally when it gets very long and exceeds the
        maximum line length limit.
      </div>
    `)
  })

  test("should handle herb:disable in inline elements", () => {
    const source = dedent`
      <p>
        Some text with <span> <%# herb:disable some-rule %>inline content</span> here.
      </p>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <p>
        Some text with <span> <%# herb:disable some-rule %>inline content</span>
        here.
      </p>
    `)
  })

  test("should handle multiple herb:disable comments (opening and middle)", () => {
    const source = dedent`
      <DIV> <%# herb:disable html-tag-name-lowercase %>
        Some content here.
        <%# herb:disable another-rule %>
        More content.
      </DIV>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <DIV> <%# herb:disable html-tag-name-lowercase %>
        Some content here. <%# herb:disable another-rule %> More content.
      </DIV>
    `)
  })

  test("should handle empty elements with herb:disable", () => {
    const source = dedent`
      <div> <%# herb:disable some-rule %>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <div> <%# herb:disable some-rule %>
      </div>
    `)
  })

  test("should handle herb:disable with ERB output tags", () => {
    const source = dedent`
      <div> <%# herb:disable some-rule %>
        <%= content %>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <div> <%# herb:disable some-rule %>
        <%= content %>
      </div>
    `)
  })

  test("should handle deeply nested herb:disable (3 levels)", () => {
    const source = dedent`
      <div>
        <section>
          <DIV> <%# herb:disable html-tag-name-lowercase %>
            Content here.
          </DIV>
        </section>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <div>
        <section>
          <DIV> <%# herb:disable html-tag-name-lowercase %>
            Content here.
          </DIV>
        </section>
      </div>
    `)
  })

  test("should handle very long herb:disable rule lists", () => {
    const source = dedent`
      <DIV> <%# herb:disable rule-one, rule-two, rule-three, rule-four, rule-five, rule-six, rule-seven %>
        Content.
      </DIV>
    `

    const result = formatter.format(source)

    expect(result).toBe(source)
  })

  test("should handle herb:disable between sibling elements", () => {
    const source = dedent`
      <div>
        <p>First paragraph</p>
        <%# herb:disable some-rule %>
        <p>Second paragraph</p>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <div>
        <p>First paragraph</p> <%# herb:disable some-rule %>
        <p>Second paragraph</p>
      </div>
    `)
  })

  test("should handle consecutive herb:disable comments", () => {
    const source = dedent`
      <DIV> <%# herb:disable rule-one %>
      <%# herb:disable rule-two %>
        Content here.
      </DIV>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <DIV> <%# herb:disable rule-one %>
        <%# herb:disable rule-two %> Content here.
      </DIV>
    `)
  })

  test("reproduces the exact issue from #738", () => {
    const source = dedent`
      <DIV> <%# herb:disable html-tag-name-lowercase %>
        Dolores id occaecati ipsam. Eius blanditiis odio quas. Corrupti officia quasi sunt neque soluta veritatis. Sint esse nihil alias quia qui. Aut omnis quia ut dolores reiciendis. Numquam voluptate esse voluptas.
      </DIV> <%# herb:disable html-tag-name-lowercase %>
    `

    const result = formatter.format(source)

    const expectedOutput = dedent`
      <DIV> <%# herb:disable html-tag-name-lowercase %>
        Dolores id occaecati ipsam. Eius blanditiis odio quas. Corrupti officia quasi
        sunt neque soluta veritatis. Sint esse nihil alias quia qui. Aut omnis quia
        ut dolores reiciendis. Numquam voluptate esse voluptas.
      </DIV> <%# herb:disable html-tag-name-lowercase %>
    `

    expect(result).toBe(expectedOutput)
  })

  test("handles erb if nodes", () => {
    const source = dedent`
      <%if valid?%> <%# herb:disable erb-require-whitespace-inside-tags %>
        <%=content%> <%# herb:disable erb-require-whitespace-inside-tags %>
      <%else%> <%# herb:disable erb-require-whitespace-inside-tags %>
        <%=other_content%> <%# herb:disable erb-require-whitespace-inside-tags %>
      <%end5> <%# herb:disable erb-require-whitespace-inside-tags %>
    `

    const result = formatter.format(source)

    expect(result).toBe(source)
  })

  test("keeps herb:disable comment on same line as tag name in multiline opening tag", () => {
    const source = dedent`
      <a <%# herb:disable html-anchor-require-href %>
        class="btn btn-secondary no-donate-btn"
        aria-label="Close"
        data-dismiss="modal"
      >
        Close
      </a>
    `

    const result = formatter.format(source)

    expect(result).toBe(source)
  })
})
