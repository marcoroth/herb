import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { isNode, getTagName, filterNodes, isHTMLOpenTagNode } from "@herb-tools/core"
import { HTMLElementNode, HTMLAttributeNode, HTMLOpenTagNode } from "@herb-tools/core"

import { AttributeRenderer } from "../src/attribute-renderer.js"
import type { AttributeRendererDelegate } from "../src/attribute-renderer.js"

import type { ERBNode } from "@herb-tools/core"

function createMockDelegate(): AttributeRendererDelegate {
  return {
    reconstructERBNode(node: ERBNode, _withFormatting: boolean): string {
      const open = node.tag_opening?.value ?? ""
      const close = node.tag_closing?.value ?? ""
      const content = node.content?.value ?? ""

      return `${open} ${content.trim()} ${close}`
    },
  }
}

function createRenderer(maxLineLength: number = 120, indentWidth: number = 2): AttributeRenderer {
  return new AttributeRenderer(createMockDelegate(), maxLineLength, indentWidth)
}

function parseAttributes(source: string): { attributes: HTMLAttributeNode[]; tagName: string } {
  const result = Herb.parse(source)
  const element = result.value.children[0]

  if (isNode(element, HTMLElementNode) && isHTMLOpenTagNode(element.open_tag)) {
    const openTag = element.open_tag as HTMLOpenTagNode
    const attributes = filterNodes(openTag.children, HTMLAttributeNode)
    const tagName = getTagName(element)

    return { attributes, tagName }
  }

  return { attributes: [], tagName: "" }
}

function parseFirstAttribute(source: string): { attribute: HTMLAttributeNode; tagName: string } {
  const { attributes, tagName } = parseAttributes(source)

  return { attribute: attributes[0], tagName }
}

describe("AttributeRenderer", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("renderAttribute", () => {
    test("renders a boolean attribute", () => {
      const renderer = createRenderer()
      const { attribute, tagName } = parseFirstAttribute('<input disabled>')

      expect(renderer.renderAttribute(attribute, tagName)).toBe("disabled")
    })

    test("renders an attribute with value", () => {
      const renderer = createRenderer()
      const { attribute, tagName } = parseFirstAttribute('<input type="text">')

      expect(renderer.renderAttribute(attribute, tagName)).toBe('type="text"')
    })

    test("normalizes single quotes to double quotes", () => {
      const renderer = createRenderer()
      const { attribute, tagName } = parseFirstAttribute("<input type='text'>")

      expect(renderer.renderAttribute(attribute, tagName)).toBe('type="text"')
    })

    test("preserves single quotes when value contains double quotes", () => {
      const renderer = createRenderer()
      const { attribute, tagName } = parseFirstAttribute(`<div data-value='"hello"'></div>`)

      expect(renderer.renderAttribute(attribute, tagName)).toBe(`data-value='"hello"'`)
    })

    test("adds quotes to unquoted attributes", () => {
      const renderer = createRenderer()
      const { attribute, tagName } = parseFirstAttribute('<input type=text>')

      expect(renderer.renderAttribute(attribute, tagName)).toBe('type="text"')
    })

    test("renders class attribute with formatting", () => {
      const renderer = createRenderer()
      const { attribute, tagName } = parseFirstAttribute('<div class="foo bar baz"></div>')

      expect(renderer.renderAttribute(attribute, tagName)).toBe('class="foo bar baz"')
    })

    test("renders ERB in attribute values", () => {
      const renderer = createRenderer()
      const { attribute, tagName } = parseFirstAttribute('<div id="<%= @id %>"></div>')

      expect(renderer.renderAttribute(attribute, tagName)).toBe('id="<%= @id %>"')
    })

    test("sets and clears currentAttributeName during render", () => {
      const renderer = createRenderer()
      const { attribute, tagName } = parseFirstAttribute('<div class="foo"></div>')

      expect(renderer.currentAttributeName).toBeNull()
      renderer.renderAttribute(attribute, tagName)
      expect(renderer.currentAttributeName).toBeNull()
    })
  })

  describe("renderAttributesString", () => {
    test("returns empty string for no attributes", () => {
      const renderer = createRenderer()

      expect(renderer.renderAttributesString([], "div")).toBe("")
    })

    test("renders single attribute with leading space", () => {
      const renderer = createRenderer()
      const { attributes, tagName } = parseAttributes('<div class="foo"></div>')

      expect(renderer.renderAttributesString(attributes, tagName)).toBe(' class="foo"')
    })

    test("renders multiple attributes space-separated", () => {
      const renderer = createRenderer()
      const { attributes, tagName } = parseAttributes('<input type="text" name="field">')
      const result = renderer.renderAttributesString(attributes, tagName)

      expect(result).toBe(' type="text" name="field"')
    })
  })

  describe("formatClassAttribute", () => {
    test("returns single-line for short classes", () => {
      const renderer = createRenderer()
      const result = renderer.formatClassAttribute("foo bar baz", "class", "=", '"', '"')

      expect(result).toBe('"foo bar baz"')
    })

    test("wraps long class lists into multiple lines", () => {
      const renderer = createRenderer(80)
      renderer.indentLevel = 1

      const longClasses = "container mx-auto px-4 py-8 flex items-center justify-between bg-gray-100 text-gray-800 font-medium"
      const result = renderer.formatClassAttribute(longClasses, "class", "=", '"', '"')

      expect(result).toBe('"\n    container mx-auto px-4 py-8 flex items-center justify-between\n    bg-gray-100 text-gray-800 font-medium\n  "')
    })

    test("does not wrap class with ERB content", () => {
      const renderer = createRenderer(80)
      renderer.indentLevel = 1

      const classWithERB = "container mx-auto px-4 py-8 flex items-center justify-between <%= @dynamic_class %> text-gray-800"
      const result = renderer.formatClassAttribute(classWithERB, "class", "=", '"', '"')

      expect(result).toBe('"container mx-auto px-4 py-8 flex items-center justify-between <%= @dynamic_class %> text-gray-800"')
    })
  })

  describe("formatMultilineAttribute", () => {
    test("normalizes srcset content", () => {
      const renderer = createRenderer()
      const content = "image-1x.png  1x,\n  image-2x.png  2x"
      const result = renderer.formatMultilineAttribute(content, "srcset", '"', '"')

      expect(result).toBe('"image-1x.png 1x, image-2x.png 2x"')
    })

    test("normalizes sizes content", () => {
      const renderer = createRenderer()
      const content = "(max-width: 600px) 480px,\n  800px"
      const result = renderer.formatMultilineAttribute(content, "sizes", '"', '"')

      expect(result).toBe('"(max-width: 600px) 480px, 800px"')
    })

    test("preserves single-line values", () => {
      const renderer = createRenderer()
      const result = renderer.formatMultilineAttribute("some value", "data-value", '"', '"')

      expect(result).toBe('"some value"')
    })

    test("formats multiline values", () => {
      const renderer = createRenderer()
      renderer.indentLevel = 1

      const result = renderer.formatMultilineAttribute("line1\nline2", "data-value", '"', '"')

      expect(result).toBe('"\n    line1\n    line2\n  "')
    })
  })

  describe("breakTokensIntoLines", () => {
    test("keeps tokens on one line if they fit", () => {
      const renderer = createRenderer(120)
      const tokens = ["foo", "bar", "baz"]
      const result = renderer.breakTokensIntoLines(tokens, 4)

      expect(result).toEqual(["foo bar baz"])
    })

    test("wraps tokens that exceed the line length", () => {
      const renderer = createRenderer(30)
      const tokens = ["container", "mx-auto", "px-4", "py-8", "flex", "items-center"]
      const result = renderer.breakTokensIntoLines(tokens, 4)

      expect(result).toEqual(["container mx-auto", "px-4 py-8 flex", "items-center"])
    })

    test("uses custom separator", () => {
      const renderer = createRenderer(120)
      const tokens = ["a", "b", "c"]
      const result = renderer.breakTokensIntoLines(tokens, 0, ", ")

      expect(result).toEqual(["a, b, c"])
    })
  })

  describe("hasMultilineAttributes", () => {
    test("detects multiline attribute values with indentation", () => {
      const renderer = createRenderer()
      const { attributes } = parseAttributes('<img srcset="image-1x.png 1x,\n  image-2x.png 2x">')

      expect(renderer.hasMultilineAttributes(attributes)).toBe(true)
    })

    test("returns false for single-line attributes", () => {
      const renderer = createRenderer()
      const { attributes } = parseAttributes('<div class="foo bar"></div>')

      expect(renderer.hasMultilineAttributes(attributes)).toBe(false)
    })
  })

  describe("shouldRenderInline", () => {
    test("returns true for 0 attributes within line length", () => {
      const renderer = createRenderer(120)

      expect(renderer.shouldRenderInline(0, 20, 4)).toBe(true)
    })

    test("returns false for 0 attributes exceeding line length", () => {
      const renderer = createRenderer(40)

      expect(renderer.shouldRenderInline(0, 40, 4)).toBe(false)
    })

    test("returns true for 1-3 attributes within line length", () => {
      const renderer = createRenderer(120)

      expect(renderer.shouldRenderInline(2, 40, 4)).toBe(true)
    })

    test("returns false for more than 3 attributes", () => {
      const renderer = createRenderer(120)

      expect(renderer.shouldRenderInline(4, 40, 4)).toBe(false)
    })

    test("returns false when exceeding line length", () => {
      const renderer = createRenderer(40)

      expect(renderer.shouldRenderInline(2, 40, 4)).toBe(false)
    })

    test("returns false with complex ERB", () => {
      const renderer = createRenderer(120)

      expect(renderer.shouldRenderInline(1, 20, 4, 120, true)).toBe(false)
    })

    test("returns false with multiline attributes", () => {
      const renderer = createRenderer(120)

      expect(renderer.shouldRenderInline(1, 20, 4, 120, false, true)).toBe(false)
    })
  })

  describe("getAttributeName", () => {
    test("extracts simple attribute name", () => {
      const renderer = createRenderer()
      const { attribute } = parseFirstAttribute('<div class="foo"></div>')

      expect(renderer.getAttributeName(attribute)).toBe("class")
    })

    test("extracts data attribute name", () => {
      const renderer = createRenderer()
      const { attribute } = parseFirstAttribute('<div data-controller="hello"></div>')

      expect(renderer.getAttributeName(attribute)).toBe("data-controller")
    })
  })

  describe("getAttributeValue", () => {
    test("extracts attribute value", () => {
      const renderer = createRenderer()
      const { attribute } = parseFirstAttribute('<div class="foo bar"></div>')

      expect(renderer.getAttributeValue(attribute)).toBe("foo bar")
    })

    test("returns empty string for boolean attributes", () => {
      const renderer = createRenderer()
      const { attribute } = parseFirstAttribute('<input disabled>')

      expect(renderer.getAttributeValue(attribute)).toBe("")
    })
  })

  describe("isFormattableAttribute", () => {
    test("class is formattable for any tag", () => {
      const renderer = createRenderer()

      expect(renderer.isFormattableAttribute("class", "div")).toBe(true)
      expect(renderer.isFormattableAttribute("class", "span")).toBe(true)
    })

    test("srcset is formattable for img", () => {
      const renderer = createRenderer()

      expect(renderer.isFormattableAttribute("srcset", "img")).toBe(true)
    })

    test("sizes is formattable for img", () => {
      const renderer = createRenderer()

      expect(renderer.isFormattableAttribute("sizes", "img")).toBe(true)
    })

    test("srcset is not formattable for non-img tags", () => {
      const renderer = createRenderer()

      expect(renderer.isFormattableAttribute("srcset", "div")).toBe(false)
    })

    test("non-formattable attribute returns false", () => {
      const renderer = createRenderer()

      expect(renderer.isFormattableAttribute("id", "div")).toBe(false)
      expect(renderer.isFormattableAttribute("style", "div")).toBe(false)
    })
  })

  describe("isInTokenListAttribute", () => {
    test("returns false when no attribute is being rendered", () => {
      const renderer = createRenderer()

      expect(renderer.isInTokenListAttribute).toBe(false)
    })

    test("returns true during class attribute rendering", () => {
      const renderer = createRenderer()
      renderer.currentAttributeName = "class"

      expect(renderer.isInTokenListAttribute).toBe(true)
    })

    test("returns true for data-controller", () => {
      const renderer = createRenderer()
      renderer.currentAttributeName = "data-controller"

      expect(renderer.isInTokenListAttribute).toBe(true)
    })

    test("returns true for data-action", () => {
      const renderer = createRenderer()
      renderer.currentAttributeName = "data-action"

      expect(renderer.isInTokenListAttribute).toBe(true)
    })

    test("returns false for non-token-list attributes", () => {
      const renderer = createRenderer()
      renderer.currentAttributeName = "id"

      expect(renderer.isInTokenListAttribute).toBe(false)
    })
  })

  describe("formatMultilineAttributeValue", () => {
    test("formats lines with proper indentation", () => {
      const renderer = createRenderer(120, 2)
      renderer.indentLevel = 1

      const result = renderer.formatMultilineAttributeValue(["line1", "line2"])

      expect(result).toBe("\n    line1\n    line2\n  ")
    })

    test("respects indent level", () => {
      const renderer = createRenderer(120, 2)
      renderer.indentLevel = 2

      const result = renderer.formatMultilineAttributeValue(["line1"])

      expect(result).toBe("\n      line1\n    ")
    })
  })

  describe("wouldClassAttributeBeMultiline", () => {
    test("returns false for short content", () => {
      const renderer = createRenderer(120)

      expect(renderer.wouldClassAttributeBeMultiline("foo bar", 4)).toBe(false)
    })

    test("returns true for long content that would wrap", () => {
      const renderer = createRenderer(50)
      const longContent = "container mx-auto px-4 py-8 flex items-center justify-between bg-gray-100 text-gray-800"

      expect(renderer.wouldClassAttributeBeMultiline(longContent, 4)).toBe(true)
    })
  })
})
