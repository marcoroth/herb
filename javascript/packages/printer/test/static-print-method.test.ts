import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Printer, IdentityPrinter } from "../src/index.js"
import type { HTMLTextNode } from "@herb-tools/core"

class UppercasePrinter extends Printer {
  visitHTMLTextNode(node: HTMLTextNode): void {
    this.write(node.content.toUpperCase())
  }
}

class NoAttributesPrinter extends Printer {
  visitHTMLAttributeNode(): void {
    // Skip attributes entirely
  }

  visitHTMLOpenTagNode(node: any): void {
    if (node.tag_opening) {
      this.context.write(node.tag_opening.value)
    }

    if (node.tag_name) {
      this.context.write(node.tag_name.value)
    }

    // Skip child nodes (attributes and whitespace)

    if (node.tag_closing) {
      this.context.write(node.tag_closing.value)
    }
  }
}

describe("Static print method", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("IdentityPrinter static method", () => {
    test("works without creating an instance", () => {
      const input = '<div class="test">Hello World</div>'
      const parseResult = Herb.parse(input, { track_whitespace: true })
      expect(parseResult.value).toBeTruthy()

      const output = IdentityPrinter.print(parseResult.value!)
      expect(output).toBe(input)
    })

    test("handles complex HTML structures", () => {
      const input = dedent`
        <div>
          <p>Paragraph</p>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </div>
      `

      const parseResult = Herb.parse(input, { track_whitespace: true })
      expect(parseResult.value).toBeTruthy()

      const output = IdentityPrinter.print(parseResult.value!)
      expect(output).toBe(input)
    })
  })

  describe("Custom printer static methods", () => {
    test("UppercasePrinter static method works", () => {
      const input = '<div>hello world</div>'
      const parseResult = Herb.parse(input, { track_whitespace: true })
      expect(parseResult.value).toBeTruthy()

      const output = UppercasePrinter.print(parseResult.value!)
      expect(output).toBe('<div>HELLO WORLD</div>')
    })

    test("NoAttributesPrinter static method works", () => {
      const input = '<div class="container" id="main">Content</div>'
      const parseResult = Herb.parse(input, { track_whitespace: true })
      expect(parseResult.value).toBeTruthy()

      const output = NoAttributesPrinter.print(parseResult.value!)
      expect(output).toBe('<div>Content</div>')
    })

    test("custom printers produce same output with static and instance methods", () => {
      const input = '<p class="text">hello</p>'
      const parseResult = Herb.parse(input, { track_whitespace: true })
      expect(parseResult.value).toBeTruthy()

      const uppercaseInstance = new UppercasePrinter()
      const uppercaseInstanceOutput = uppercaseInstance.print(parseResult.value!)
      const uppercaseStaticOutput = UppercasePrinter.print(parseResult.value!)
      expect(uppercaseStaticOutput).toBe(uppercaseInstanceOutput)
      expect(uppercaseStaticOutput).toBe('<p class="text">HELLO</p>')

      const noAttrInstance = new NoAttributesPrinter()
      const noAttrInstanceOutput = noAttrInstance.print(parseResult.value!)
      const noAttrStaticOutput = NoAttributesPrinter.print(parseResult.value!)
      expect(noAttrStaticOutput).toBe(noAttrInstanceOutput)
      expect(noAttrStaticOutput).toBe('<p>hello</p>')
    })
  })

  describe("Options handling", () => {
    test("static method respects print options", () => {
      const input = '<div>Test'
      const parseResult = Herb.parse(input, { track_whitespace: true })

      expect(() => IdentityPrinter.print(parseResult.value!)).toThrow(/Cannot print the node/)

      const output = IdentityPrinter.print(parseResult.value!, { ignoreErrors: true })
      expect(output).toBe(input)
    })

    test("custom printer static method respects options", () => {
      const input = '<p>error test'
      const parseResult = Herb.parse(input, { track_whitespace: true })

      expect(() => UppercasePrinter.print(parseResult.value!)).toThrow()

      const output = UppercasePrinter.print(parseResult.value!, { ignoreErrors: true })
      expect(output).toBe('<p>ERROR TEST')
    })
  })
})
