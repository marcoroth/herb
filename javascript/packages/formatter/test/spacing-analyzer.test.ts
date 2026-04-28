import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { isNode, getTagName } from "@herb-tools/core"
import { Node, HTMLElementNode, HTMLTextNode } from "@herb-tools/core"

import { SpacingAnalyzer } from "../src/spacing-analyzer.js"

function parse(source: string) {
  return Herb.parse(source)
}

function parseChildren(source: string): Node[] {
  return parse(source).value.children
}

function parseBody(source: string): { body: Node[]; element: HTMLElementNode | null } {
  const children = parseChildren(source)
  const element = children[0]

  if (isNode(element, HTMLElementNode)) {
    return { body: element.body, element }
  }

  return { body: children, element: null }
}

describe("SpacingAnalyzer", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("shouldAddSpacingBetweenSiblings", () => {
    test("adds spacing after doctype", () => {
      const nodeIsMultiline = new Map<Node, boolean>()
      const analyzer = new SpacingAnalyzer(nodeIsMultiline)
      const children = parseChildren("<!DOCTYPE html>\n<html></html>")

      let htmlIndex = -1

      for (let i = 0; i < children.length; i++) {
        if (isNode(children[i], HTMLElementNode) && getTagName(children[i] as HTMLElementNode) === "html") {
          htmlIndex = i
          break
        }
      }

      expect(htmlIndex).toBeGreaterThan(0)
      expect(analyzer.shouldAddSpacingBetweenSiblings(null, children, htmlIndex)).toBe(true)
    })

    test("returns false when siblings have mixed text content", () => {
      const nodeIsMultiline = new Map<Node, boolean>()
      const analyzer = new SpacingAnalyzer(nodeIsMultiline)
      const { body, element } = parseBody("<div>text <span>a</span> <span>b</span></div>")

      let targetIndex = -1

      for (let i = 1; i < body.length; i++) {
        if (isNode(body[i], HTMLElementNode)) {
          targetIndex = i
          break
        }
      }

      if (targetIndex > 0) {
        expect(analyzer.shouldAddSpacingBetweenSiblings(element, body, targetIndex)).toBe(false)
      }
    })

    test("adds spacing between multiline elements", () => {
      const nodeIsMultiline = new Map<Node, boolean>()
      const analyzer = new SpacingAnalyzer(nodeIsMultiline)
      const { body, element } = parseBody("<div>\n<p>a</p>\n<p>b</p>\n</div>")

      for (const child of body) {
        if (isNode(child, HTMLElementNode)) {
          nodeIsMultiline.set(child, true)
        }
      }

      let count = 0
      let secondPIndex = -1

      for (let i = 0; i < body.length; i++) {
        if (isNode(body[i], HTMLElementNode) && getTagName(body[i] as HTMLElementNode) === "p") {
          count++
          if (count === 2) {
            secondPIndex = i
            break
          }
        }
      }

      expect(secondPIndex).toBeGreaterThan(0)
      expect(analyzer.shouldAddSpacingBetweenSiblings(element, body, secondPIndex)).toBe(true)
    })

    test("returns false for inline elements", () => {
      const nodeIsMultiline = new Map<Node, boolean>()
      const analyzer = new SpacingAnalyzer(nodeIsMultiline)
      const { body, element } = parseBody("<div>\n<span>a</span>\n<span>b</span>\n<span>c</span>\n</div>")

      let lastSpanIndex = -1

      for (let i = body.length - 1; i >= 0; i--) {
        if (isNode(body[i], HTMLElementNode) && getTagName(body[i] as HTMLElementNode) === "span") {
          lastSpanIndex = i
          break
        }
      }

      if (lastSpanIndex > 0) {
        expect(analyzer.shouldAddSpacingBetweenSiblings(element, body, lastSpanIndex)).toBe(false)
      }
    })

    test("returns false for elements in same tag group", () => {
      const nodeIsMultiline = new Map<Node, boolean>()
      const analyzer = new SpacingAnalyzer(nodeIsMultiline)
      const { body, element } = parseBody("<section>\n<p>a</p>\n<p>b</p>\n<p>c</p>\n<div>x</div>\n</section>")

      let count = 0
      let secondPIndex = -1

      for (let i = 0; i < body.length; i++) {
        if (isNode(body[i], HTMLElementNode) && getTagName(body[i] as HTMLElementNode) === "p") {
          count++
          if (count === 2) {
            secondPIndex = i
            break
          }
        }
      }

      expect(secondPIndex).toBeGreaterThan(0)
      expect(analyzer.shouldAddSpacingBetweenSiblings(element, body, secondPIndex)).toBe(false)
    })

    test("adds spacing at group boundary in spaceable container", () => {
      const nodeIsMultiline = new Map<Node, boolean>()
      const analyzer = new SpacingAnalyzer(nodeIsMultiline)
      const { body, element } = parseBody("<section>\n<p>a</p>\n<p>b</p>\n<div>x</div>\n</section>")

      let divIndex = -1

      for (let i = 0; i < body.length; i++) {
        if (isNode(body[i], HTMLElementNode) && getTagName(body[i] as HTMLElementNode) === "div") {
          divIndex = i
          break
        }
      }

      expect(divIndex).toBeGreaterThan(0)
      expect(analyzer.shouldAddSpacingBetweenSiblings(element, body, divIndex)).toBe(true)
    })

    test("returns false for non-spaceable containers with fewer than 5 meaningful children", () => {
      const nodeIsMultiline = new Map<Node, boolean>()
      const analyzer = new SpacingAnalyzer(nodeIsMultiline)
      const { body, element } = parseBody("<ul>\n<li>a</li>\n<li>b</li>\n<li>c</li>\n</ul>")

      let count = 0
      let secondLiIndex = -1

      for (let i = 0; i < body.length; i++) {
        if (isNode(body[i], HTMLElementNode) && getTagName(body[i] as HTMLElementNode) === "li") {
          count++
          if (count === 2) {
            secondLiIndex = i
            break
          }
        }
      }

      if (secondLiIndex > 0) {
        expect(analyzer.shouldAddSpacingBetweenSiblings(element, body, secondLiIndex)).toBe(false)
      }
    })

    test("does not add spacing between consecutive comments", () => {
      const nodeIsMultiline = new Map<Node, boolean>()
      const analyzer = new SpacingAnalyzer(nodeIsMultiline)
      const { body, element } = parseBody("<div>\n<!-- a -->\n<!-- b -->\n</div>")

      let commentCount = 0
      let secondCommentIndex = -1

      for (let i = 0; i < body.length; i++) {
        const child = body[i]

        if (!isNode(child, HTMLTextNode) || child.content.trim() !== "") {
          if (!isNode(child, HTMLTextNode)) {
            commentCount++

            if (commentCount === 2) {
              secondCommentIndex = i
              break
            }
          }
        }
      }

      if (secondCommentIndex > 0) {
        expect(analyzer.shouldAddSpacingBetweenSiblings(element, body, secondCommentIndex)).toBe(false)
      }
    })
  })

  describe("hasBlankLineBetween", () => {
    test("detects double newline in preceding text node", () => {
      const nodeIsMultiline = new Map<Node, boolean>()
      const analyzer = new SpacingAnalyzer(nodeIsMultiline)
      const { body } = parseBody("<div>\n<p>a</p>\n\n<p>b</p>\n</div>")

      let count = 0
      let secondPIndex = -1

      for (let i = 0; i < body.length; i++) {
        if (isNode(body[i], HTMLElementNode) && getTagName(body[i] as HTMLElementNode) === "p") {
          count++

          if (count === 2) {
            secondPIndex = i
            break
          }
        }
      }

      expect(secondPIndex).toBeGreaterThan(0)
      expect(analyzer.hasBlankLineBetween(body, secondPIndex)).toBe(true)
    })

    test("returns false for single newlines", () => {
      const nodeIsMultiline = new Map<Node, boolean>()
      const analyzer = new SpacingAnalyzer(nodeIsMultiline)
      const { body } = parseBody("<div>\n<p>a</p>\n<p>b</p>\n</div>")

      let count = 0
      let secondPIndex = -1

      for (let i = 0; i < body.length; i++) {
        if (isNode(body[i], HTMLElementNode) && getTagName(body[i] as HTMLElementNode) === "p") {
          count++

          if (count === 2) {
            secondPIndex = i
            break
          }
        }
      }

      expect(secondPIndex).toBeGreaterThan(0)
      expect(analyzer.hasBlankLineBetween(body, secondPIndex)).toBe(false)
    })
  })

  describe("clear", () => {
    test("resets internal caches", () => {
      const nodeIsMultiline = new Map<Node, boolean>()
      const analyzer = new SpacingAnalyzer(nodeIsMultiline)
      const { body, element } = parseBody("<section>\n<p>a</p>\n<p>b</p>\n<div>x</div>\n</section>")

      for (let i = 0; i < body.length; i++) {
        if (isNode(body[i], HTMLElementNode)) {
          analyzer.shouldAddSpacingBetweenSiblings(element, body, i)
        }
      }

      expect(() => analyzer.clear()).not.toThrow()

      let divIndex = -1

      for (let i = 0; i < body.length; i++) {
        if (isNode(body[i], HTMLElementNode) && getTagName(body[i] as HTMLElementNode) === "div") {
          divIndex = i
          break
        }
      }

      if (divIndex > 0) {
        expect(analyzer.shouldAddSpacingBetweenSiblings(element, body, divIndex)).toBe(true)
      }
    })
  })
})
