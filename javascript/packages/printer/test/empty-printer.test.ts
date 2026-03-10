import { describe, it, expect, beforeAll } from "vitest"
import { Printer } from "../src/printer.js"
import { Herb } from "@herb-tools/node-wasm"

class EmptyPrinter extends Printer {
  // Extends Printer without overriding any visitor methods
}

describe("EmptyPrinter", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  it("returns empty string when extending Printer directly", () => {
    const input = "<div>Hello World</div>"
    const result = Herb.parse(input)
    const printer = new EmptyPrinter()
    const output = printer.print(result)

    expect(output).toBe("")
  })

  it("returns empty string for ERB content", () => {
    const input = "<%= user.name %>"
    const result = Herb.parse(input)
    const printer = new EmptyPrinter()
    const output = printer.print(result)

    expect(output).toBe("")
  })

  it("returns empty string for mixed HTML and ERB", () => {
    const input = '<div class="user"><%= user.name %></div>'
    const result = Herb.parse(input)
    const printer = new EmptyPrinter()
    const output = printer.print(result)

    expect(output).toBe("")
  })

  it("static print method also returns empty string", () => {
    const input = "<p>Test</p>"
    const result = Herb.parse(input)
    const output = EmptyPrinter.print(result)

    expect(output).toBe("")
  })
})
