import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLBooleanAttributesNoValueRule } from "../../src/rules/html-boolean-attributes-no-value.js"

describe("html-boolean-attributes-no-value autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("removes value from single boolean attribute", () => {
    const input = '<input type="checkbox" checked="checked">'
    const expected = '<input type="checkbox" checked>'

    const linter = new Linter(Herb, [HTMLBooleanAttributesNoValueRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("removes values from multiple boolean attributes", () => {
    const input = '<input type="checkbox" checked="checked" disabled="disabled">'
    const expected = '<input type="checkbox" checked disabled>'

    const linter = new Linter(Herb, [HTMLBooleanAttributesNoValueRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("removes value from boolean attribute with true/false", () => {
    const input = '<button disabled="true">Submit</button>'
    const expected = '<button disabled>Submit</button>'

    const linter = new Linter(Herb, [HTMLBooleanAttributesNoValueRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("handles self-closing tags", () => {
    const input = '<input type="checkbox" checked="checked" required="true" />'
    const expected = '<input type="checkbox" checked required />'

    const linter = new Linter(Herb, [HTMLBooleanAttributesNoValueRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("handles multiple elements with boolean attributes", () => {
    const input = dedent`
      <input checked="checked">
      <button disabled="disabled">Click</button>
      <video controls="controls" autoplay="autoplay"></video>
    `

    const expected = dedent`
      <input checked>
      <button disabled>Click</button>
      <video controls autoplay></video>
    `

    const linter = new Linter(Herb, [HTMLBooleanAttributesNoValueRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(4)
  })

  test("preserves non-boolean attributes", () => {
    const input = '<input type="text" value="test" checked="checked">'
    const expected = '<input type="text" value="test" checked>'

    const linter = new Linter(Herb, [HTMLBooleanAttributesNoValueRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("handles video element boolean attributes", () => {
    const input = '<video controls="controls" autoplay="autoplay" loop="loop" muted="muted"></video>'
    const expected = '<video controls autoplay loop muted></video>'

    const linter = new Linter(Herb, [HTMLBooleanAttributesNoValueRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(4)
  })

  test("handles select and option boolean attributes", () => {
    const input = '<select multiple="multiple"><option selected="selected">Option</option></select>'
    const expected = '<select multiple><option selected>Option</option></select>'

    const linter = new Linter(Herb, [HTMLBooleanAttributesNoValueRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("handles boolean attributes with different values", () => {
    const input = '<video controls="something-else"></video>'
    const expected = '<video controls></video>'

    const linter = new Linter(Herb, [HTMLBooleanAttributesNoValueRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })
})
