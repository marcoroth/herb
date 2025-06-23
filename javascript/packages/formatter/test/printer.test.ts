import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Printer } from "../src/printer.js"

import dedent from "dedent"

import type { HTMLElementNode, HTMLOpenTagNode, HTMLAttributeNode, HTMLAttributeNameNode, HTMLAttributeValueNode } from "@herb-tools/core"

function printerFor(source: string): Printer {
  return new Printer(source, {
    indentWidth: 2,
    maxLineLength: 80
  })
}

describe("@herb-tools/formatter", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("empty html tag", () => {
    const source = `<div></div>`
    const result = Herb.parse(source)
    const divTag = result.value.children[0] as HTMLElementNode
    const openTag = divTag.open_tag
    const close_tag = divTag.close_tag

    const printer = printerFor(source)

    expect(printer.print(divTag)).toEqual(dedent`
      <div></div>
    `)

    expect(printer.print(openTag)).toEqual(dedent`
      <div>
    `)

    expect(printer.print(close_tag)).toEqual(dedent`
      </div>
    `)
  })

  test("html attribute", () => {
    const source = `<div id="hello"></div>`
    const result = Herb.parse(source)
    const divTag = result.value.children[0] as HTMLElementNode
    const openTag = divTag.open_tag as HTMLOpenTagNode
    const idAttribute = openTag.children[0] as HTMLAttributeNode
    const name = idAttribute.name as HTMLAttributeNameNode
    const value = idAttribute.name as HTMLAttributeValueNode

    const printer = printerFor(source)

    expect(printer.print(idAttribute)).toEqual(dedent`
      id="hello"
    `)

    expect(printer.print(name)).toEqual(dedent`
      id
    `)

    expect(printer.print(value)).toEqual(dedent`
      hello
    `)
  })
})
