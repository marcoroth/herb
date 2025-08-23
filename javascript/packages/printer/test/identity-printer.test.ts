import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { IdentityPrinter } from "../src/index.js"

describe("IdentityPrinter", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  function expectPrintRoundTrip(input: string, description: string) {
    test(description, () => {
      const parseResult = Herb.parse(input, { track_whitespace: true })
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

    test("static print method works", () => {
      const input = '<div>Hello World</div>'
      const parseResult = Herb.parse(input, { track_whitespace: true })
      expect(parseResult.value).toBeTruthy()

      const output = IdentityPrinter.print(parseResult.value!)
      expect(output).toBe(input)
    })

    test("static print method produces same output as instance method", () => {
      const input = '<p class="paragraph">Test paragraph</p>'
      const parseResult = Herb.parse(input, { track_whitespace: true })
      expect(parseResult.value).toBeTruthy()

      const printer = new IdentityPrinter()
      const instanceOutput = printer.print(parseResult.value!)
      const staticOutput = IdentityPrinter.print(parseResult.value!)

      expect(staticOutput).toBe(instanceOutput)
      expect(staticOutput).toBe(input)
    })

    test("static print method respects options", () => {
      const input = '<div id="error">Error'
      const parseResult = Herb.parse(input, { track_whitespace: true })

      expect(() => IdentityPrinter.print(parseResult.value!)).toThrow()

      const output = IdentityPrinter.print(parseResult.value!, { ignoreErrors: true })
      expect(output).toBe(input)
    })
  })

  describe("HTML Structure Round-trip Verification", () => {
    expectPrintRoundTrip('<div>Hello World</div>', 'simple div with text')
    expectPrintRoundTrip('<p>Simple paragraph</p>', 'simple paragraph')
    expectPrintRoundTrip('<span>Inline text</span>', 'simple span')

    expectPrintRoundTrip('<div><p>Nested content</p></div>', 'nested elements')
    expectPrintRoundTrip('<div><p><span>Deep nesting</span></p></div>', 'deeply nested elements')
    expectPrintRoundTrip('<ul><li>Item 1</li><li>Item 2</li></ul>', 'list with items')

    expectPrintRoundTrip('<input type="text" value="test">', 'self-closing tag with attributes')
    expectPrintRoundTrip('<br>', 'self-closing tag without attributes')
    expectPrintRoundTrip('<img src="test.jpg" alt="Test">', 'img tag with attributes')

    expectPrintRoundTrip('<div class="container" id="main">Content</div>', 'element with multiple attributes')
    expectPrintRoundTrip('<input type="text" value="hello world" required>', 'input with various attributes')
    expectPrintRoundTrip('<a href="/path" target="_blank">Link</a>', 'anchor with attributes')
  })

  describe("Whitespace Preservation", () => {
    expectPrintRoundTrip('<div>  Hello  World  </div>', 'multiple spaces in text')
    expectPrintRoundTrip('<div>\n  Hello\n  World\n</div>', 'newlines and indentation')
    expectPrintRoundTrip('<div>\t\tTab indented\t\t</div>', 'tab characters')
    expectPrintRoundTrip('<pre>  Preformatted\n  Text  </pre>', 'preformatted whitespace')
    expectPrintRoundTrip('<code>  const x = 5;  </code>', 'code with spaces')
    expectPrintRoundTrip('<div>   </div>', 'element with only whitespace')
    expectPrintRoundTrip('   <div>Content</div>   ', 'whitespace around elements')
  })

  describe("HTML Comments and Special Elements", () => {
    expectPrintRoundTrip('<!-- This is a comment -->', 'HTML comment')
    expectPrintRoundTrip('<div><!-- Inline comment --></div>', 'comment inside element')
    expectPrintRoundTrip('<!DOCTYPE html>', 'DOCTYPE declaration')
    expectPrintRoundTrip('<!DOCTYPE html><html><body></body></html>', 'DOCTYPE with document structure')
  })

  describe("Empty and Edge Cases", () => {
    expectPrintRoundTrip('', 'empty input')
    expectPrintRoundTrip('<div></div>', 'empty div')
    expectPrintRoundTrip('<p></p>', 'empty paragraph')
    expectPrintRoundTrip('<span></span><div></div>', 'multiple empty elements')
    expectPrintRoundTrip('<div>\n</div>', 'element with only newline')
    expectPrintRoundTrip('   \n   \t   ', 'only whitespace')
  })
})
