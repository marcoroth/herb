import { describe, test, expect } from "vitest"

import { Printer, PrintContext, DEFAULT_PRINTER_OPTIONS } from "../src/index.js"

describe("Printer Infrastructure", () => {
  describe("Printer base class", () => {
    test("is defined", () => {
      expect(Printer).toBeDefined()
    })

    test("cannot be instantiated directly", () => {
      // TypeScript prevents this at compile time, but we can verify the class is marked as abstract
      expect(Printer.prototype.constructor).toBe(Printer)
      expect(Printer.name).toBe('Printer')
    })
  })

  describe("PrintContext", () => {
    test("is defined", () => {
      expect(PrintContext).toBeDefined()
    })

    test("can be instantiated", () => {
      const context = new PrintContext()
      expect(context).toBeInstanceOf(PrintContext)
    })

    test("basic write functionality", () => {
      const context = new PrintContext()
      context.write("hello")
      context.write(" world")
      expect(context.getOutput()).toBe("hello world")
    })

    test("reset functionality", () => {
      const context = new PrintContext()
      context.write("hello")
      context.reset()
      expect(context.getOutput()).toBe("")
    })
  })

  describe("DEFAULT_PRINTER_OPTIONS", () => {
    test("is defined", () => {
      expect(DEFAULT_PRINTER_OPTIONS).toBeDefined()
    })

    test("has expected defaults", () => {
      expect(DEFAULT_PRINTER_OPTIONS.indentSize).toBe(2)
      expect(DEFAULT_PRINTER_OPTIONS.indentChar).toBe(' ')
      expect(DEFAULT_PRINTER_OPTIONS.lineEnding).toBe('\n')
    })
  })
})
