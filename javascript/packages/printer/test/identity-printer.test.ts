import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { IdentityPrinter } from "../src/index.js"

describe("IdentityPrinter", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  function roundTripTest(input: string, description: string) {
    test(description, () => {
      const parseResult = Herb.parse(input)
      expect(parseResult.value).toBeTruthy()

      const printer = new IdentityPrinter()
      const output = printer.print(parseResult.value!)

      expect(output).toBe(input)
    })
  }

  describe("Basic functionality", () => {
    test("is defined", () => {
      expect(IdentityPrinter).toBeDefined()
    })

    test("can be instantiated", () => {
      const printer = new IdentityPrinter()
      expect(printer).toBeInstanceOf(IdentityPrinter)
    })

    test("can be instantiated with options", () => {
      const printer = new IdentityPrinter({ indentSize: 4 })
      expect(printer).toBeInstanceOf(IdentityPrinter)
    })
  })

  describe("HTML Structure Round-trip Verification", () => {
    roundTripTest('<div>Hello World</div>', 'simple div with text')
    roundTripTest('<p>Simple paragraph</p>', 'simple paragraph')
    roundTripTest('<span>Inline text</span>', 'simple span')

    roundTripTest('<div><p>Nested content</p></div>', 'nested elements')
    roundTripTest('<div><p><span>Deep nesting</span></p></div>', 'deeply nested elements')
    roundTripTest('<ul><li>Item 1</li><li>Item 2</li></ul>', 'list with items')

    roundTripTest('<input type="text" value="test">', 'self-closing tag with attributes')
    roundTripTest('<br>', 'self-closing tag without attributes')
    roundTripTest('<img src="test.jpg" alt="Test">', 'img tag with attributes')

    roundTripTest('<div class="container" id="main">Content</div>', 'element with multiple attributes')
    roundTripTest('<input type="text" value="hello world" required>', 'input with various attributes')
    roundTripTest('<a href="/path" target="_blank">Link</a>', 'anchor with attributes')
  })

  describe("Whitespace Preservation", () => {
    roundTripTest('<div>  Hello  World  </div>', 'multiple spaces in text')
    roundTripTest('<div>\n  Hello\n  World\n</div>', 'newlines and indentation')
    roundTripTest('<div>\t\tTab indented\t\t</div>', 'tab characters')
    roundTripTest('<pre>  Preformatted\n  Text  </pre>', 'preformatted whitespace')
    roundTripTest('<code>  const x = 5;  </code>', 'code with spaces')
    roundTripTest('<div>   </div>', 'element with only whitespace')
    roundTripTest('   <div>Content</div>   ', 'whitespace around elements')
  })

  describe("HTML Comments and Special Elements", () => {
    roundTripTest('<!-- This is a comment -->', 'HTML comment')
    roundTripTest('<div><!-- Inline comment --></div>', 'comment inside element')
    roundTripTest('<!DOCTYPE html>', 'DOCTYPE declaration')
    roundTripTest('<!DOCTYPE html><html><body></body></html>', 'DOCTYPE with document structure')
  })

  describe("Empty and Edge Cases", () => {
    roundTripTest('', 'empty input')
    roundTripTest('<div></div>', 'empty div')
    roundTripTest('<p></p>', 'empty paragraph')
    roundTripTest('<span></span><div></div>', 'multiple empty elements')
    roundTripTest('<div>\n</div>', 'element with only newline')
    roundTripTest('   \n   \t   ', 'only whitespace')
  })
})
