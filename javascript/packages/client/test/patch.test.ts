import { describe, test, expect, beforeEach } from "vitest"
import { applyPatch } from "../src/patch"
import type { PatchMessage } from "../src/types"

function createPatch(file: string, operations: PatchMessage["operations"]): PatchMessage {
  return { type: "patch", file, operations }
}

function createElement(html: string): HTMLElement {
  const template = document.createElement("template")
  template.innerHTML = html.trim()

  const element = template.content.firstElementChild as HTMLElement
  document.body.appendChild(element)

  return element
}

describe("applyPatch", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  describe("text_changed", () => {
    test("updates text content in matching root", () => {
      const root = createElement(`<div data-herb-debug-file-relative-path="app/views/test.erb">Hello</div>`)

      const result = applyPatch(createPatch("app/views/test.erb", [{
        type: "text_changed",
        path: [0],
        old_value: "Hello",
        new_value: "World",
        old_node_type: "AST_HTML_TEXT_NODE",
        new_node_type: "AST_HTML_TEXT_NODE",
      }]))

      expect(result).toBe(true)
      expect(root.textContent).toBe("World")
    })

    test("updates text in nested elements", () => {
      const root = createElement(`<div data-herb-debug-file-relative-path="app/views/test.erb"><p>Hello</p><span>Keep</span></div>`)

      const p = root.querySelector("p")!
      const span = root.querySelector("span")!

      const result = applyPatch(createPatch("app/views/test.erb", [{
        type: "text_changed",
        path: [0, 0],
        old_value: "Hello",
        new_value: "Changed",
        old_node_type: "AST_HTML_TEXT_NODE",
        new_node_type: "AST_HTML_TEXT_NODE",
      }]))

      expect(result).toBe(true)
      expect(p.textContent).toBe("Changed")
      expect(span.textContent).toBe("Keep")
    })

    test("trims whitespace when matching text nodes", () => {
      const root = createElement(`<div data-herb-debug-file-relative-path="test.erb">  Hello  </div>`)

      const result = applyPatch(createPatch("test.erb", [{
        type: "text_changed",
        path: [0],
        old_value: "Hello",
        new_value: "World",
        old_node_type: "AST_HTML_TEXT_NODE",
        new_node_type: "AST_HTML_TEXT_NODE",
      }]))

      expect(result).toBe(true)
      expect(root.textContent).toBe("World")
    })

    test("returns false when old text not found", () => {
      createElement(`<div data-herb-debug-file-relative-path="test.erb">Existing</div>`)

      const result = applyPatch(createPatch("test.erb", [{
        type: "text_changed",
        path: [0],
        old_value: "NotHere",
        new_value: "World",
        old_node_type: "AST_HTML_TEXT_NODE",
        new_node_type: "AST_HTML_TEXT_NODE",
      }]))

      expect(result).toBe(false)
    })

    test("patches all matching roots", () => {
      const root1 = createElement(`<div data-herb-debug-file-relative-path="app/views/_card.erb">Hello</div>`)
      const root2 = createElement(`<div data-herb-debug-file-relative-path="app/views/_card.erb">Hello</div>`)

      const result = applyPatch(createPatch("app/views/_card.erb", [{
        type: "text_changed",
        path: [0],
        old_value: "Hello",
        new_value: "Updated",
        old_node_type: "AST_HTML_TEXT_NODE",
        new_node_type: "AST_HTML_TEXT_NODE",
      }]))

      expect(result).toBe(true)
      expect(root1.textContent).toBe("Updated")
      expect(root2.textContent).toBe("Updated")
    })
  })

  describe("attribute_value_changed", () => {
    test("updates attribute value", () => {
      const root = createElement(`<div data-herb-debug-file-relative-path="test.erb" class="old">Content</div>`)

      const result = applyPatch(createPatch("test.erb", [{
        type: "attribute_value_changed",
        path: [0],
        old_value: 'class="old"',
        new_value: 'class="new"',
        old_node_type: "AST_HTML_ATTRIBUTE_NODE",
        new_node_type: "AST_HTML_ATTRIBUTE_NODE",
      }]))

      expect(result).toBe(true)
      expect(root.className).toBe("new")
    })

    test("updates attribute on nested element", () => {
      const root = createElement(`<div data-herb-debug-file-relative-path="test.erb"><span class="old">Content</span></div>`)
      const span = root.querySelector("span")!

      const result = applyPatch(createPatch("test.erb", [{
        type: "attribute_value_changed",
        path: [0, 0],
        old_value: 'class="old"',
        new_value: 'class="new"',
        old_node_type: "AST_HTML_ATTRIBUTE_NODE",
        new_node_type: "AST_HTML_ATTRIBUTE_NODE",
      }]))

      expect(result).toBe(true)
      expect(span.className).toBe("new")
    })
  })

  describe("attribute_added", () => {
    test("adds new attribute to root element", () => {
      const root = createElement(`<div data-herb-debug-file-relative-path="test.erb">Content</div>`)

      const result = applyPatch(createPatch("test.erb", [{
        type: "attribute_added",
        path: [0],
        old_value: null,
        new_value: 'id="main"',
        old_node_type: null,
        new_node_type: "AST_HTML_ATTRIBUTE_NODE",
      }]))

      expect(result).toBe(true)
      expect(root.id).toBe("main")
    })
  })

  describe("attribute_removed", () => {
    test("removes attribute from element", () => {
      const root = createElement(`<div data-herb-debug-file-relative-path="test.erb" id="remove-me">Content</div>`)

      const result = applyPatch(createPatch("test.erb", [{
        type: "attribute_removed",
        path: [0],
        old_value: 'id="remove-me"',
        new_value: null,
        old_node_type: "AST_HTML_ATTRIBUTE_NODE",
        new_node_type: null,
      }]))

      expect(result).toBe(true)
      expect(root.id).toBe("")
    })
  })

  describe("edge cases", () => {
    test("returns false when no roots match file", () => {
      createElement(`<div>No debug attributes</div>`)

      const result = applyPatch(createPatch("missing.erb", [{
        type: "text_changed",
        path: [0],
        old_value: "Hello",
        new_value: "World",
        old_node_type: "AST_HTML_TEXT_NODE",
        new_node_type: "AST_HTML_TEXT_NODE",
      }]))

      expect(result).toBe(false)
    })

    test("returns false for empty operations array", () => {
      createElement(`<div data-herb-debug-file-relative-path="test.erb">Content</div>`)

      const result = applyPatch(createPatch("test.erb", []))

      expect(result).toBe(false)
    })

    test("returns false for unhandled operation type", () => {
      createElement(`<div data-herb-debug-file-relative-path="test.erb">Content</div>`)

      const result = applyPatch(createPatch("test.erb", [{
        type: "node_inserted",
        path: [0],
        old_value: null,
        new_value: null,
        old_node_type: null,
        new_node_type: null,
      }]))

      expect(result).toBe(false)
    })
  })
})
