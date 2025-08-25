import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { IdentityPrinter } from "../src/index.js"
import { Range } from "@herb-tools/core"
import type { HTMLTextNode } from "@herb-tools/core"

class UppercasePrinter extends IdentityPrinter {
  visitHTMLTextNode(node: HTMLTextNode): void {
    this.write(node.content.toUpperCase())
  }
}

class NoAttributesPrinter extends IdentityPrinter {
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

  describe("Token and ParseResult handling", () => {
    test("can print Token objects", () => {
      const token = {
        constructor: { name: "Token" },
        value: "hello",
        range: new Range(0, 5),
        location: null,
        type: "TEXT"
      }

      const output = IdentityPrinter.print(token)
      expect(output).toBe("hello")
    })

    test("can print ParseResult objects", () => {
      const input = `<div>Hello from ParseResult</div>`
      const parseResult = Herb.parse(input, { track_whitespace: true })
      expect(parseResult.value).toBeTruthy()

      const output = IdentityPrinter.print(parseResult)
      expect(output).toBe(input)
    })

    test("instance method also handles Token and ParseResult", () => {
      const input = `<p>Test content</p>`
      const parseResult = Herb.parse(input, { track_whitespace: true })

      const printer = new IdentityPrinter()

      const parseResultOutput = printer.print(parseResult)
      expect(parseResultOutput).toBe(input)

      const token = {
        constructor: { name: "Token" },
        value: "test",
        range: new Range(0, 4),
        location: null,
        type: "TEXT"
      }

      const tokenOutput = printer.print(token)
      expect(tokenOutput).toBe("test")
    })

    test("custom printers work with Token and ParseResult", () => {
      const input = `<div>hello world</div>`
      const parseResult = Herb.parse(input, { track_whitespace: true })

      const uppercaseOutput = UppercasePrinter.print(parseResult)
      expect(uppercaseOutput).toBe(`<div>HELLO WORLD</div>`)

      const token = {
        constructor: { name: "Token" },
        value: "hello",
        range: new Range(0, 5),
        location: null,
        type: "TEXT"
      }

      const tokenOutput = UppercasePrinter.print(token)
      expect(tokenOutput).toBe("hello")
    })

    test("ParseResult with errors respects ignoreErrors option", () => {
      const input = `<div>Incomplete`
      const parseResult = Herb.parse(input, { track_whitespace: true })

      expect(() => IdentityPrinter.print(parseResult)).toThrow()

      const output = IdentityPrinter.print(parseResult, { ignoreErrors: true })
      expect(output).toBe(input)
    })
  })
})
