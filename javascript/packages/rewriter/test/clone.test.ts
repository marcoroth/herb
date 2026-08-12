import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { IdentityPrinter } from "@herb-tools/printer"

import { cloneNode, ActionViewTagHelperToHTMLRewriter, HTMLToActionViewTagHelperRewriter, ERBStringToDirectOutputRewriter } from "../src/index.js"

import type { Node, HTMLElementNode } from "@herb-tools/core"
import type { ASTRewriter, RewriteContext } from "../src/index.js"

function parse(source: string, options = {}): Node {
  const parseResult = Herb.parse(source, { track_whitespace: true, ...options })

  if (parseResult.failed) {
    throw new Error(
      `Parser errors:\n${parseResult.recursiveErrors().map(error => `  - ${error.message}`).join("\n")}`
    )
  }

  return parseResult.value
}

function rewriteCopy(rewriter: ASTRewriter, node: Node, context: RewriteContext = { baseDir: process.cwd() }): Node {
  const source = IdentityPrinter.print(node)
  const tree = node.inspect()

  const rewritten = rewriter.rewrite(cloneNode(node), context)

  expect(IdentityPrinter.print(node)).toBe(source)
  expect(node.inspect()).toBe(tree)
  expect(rewritten).not.toBe(node)

  return rewritten
}

describe("cloneNode", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("returns an equivalent tree", () => {
    const node = parse('<div class="one two"><span>Content</span></div>')
    const copy = cloneNode(node)

    expect(copy).not.toBe(node)
    expect(copy.constructor).toBe(node.constructor)
    expect(copy.type).toBe(node.type)
    expect(IdentityPrinter.print(copy)).toBe(IdentityPrinter.print(node))
    expect(copy.inspect()).toBe(node.inspect())
  })

  test("copies nested nodes and arrays", () => {
    const node = parse("<div><span>Content</span></div>")
    const copy = cloneNode(node)

    expect(copy.compactChildNodes()[0]).not.toBe(node.compactChildNodes()[0])
    expect((copy as any).children).not.toBe((node as any).children)

    const element = node.compactChildNodes()[0] as HTMLElementNode
    const copiedElement = copy.compactChildNodes()[0] as HTMLElementNode

    expect(copiedElement.open_tag).not.toBe(element.open_tag)
    expect(copiedElement.body[0]).not.toBe(element.body[0])
  })

  test("shares locations with the original", () => {
    const node = parse("<div>Content</div>")
    const copy = cloneNode(node)

    const element = node.compactChildNodes()[0] as HTMLElementNode
    const copiedElement = copy.compactChildNodes()[0] as HTMLElementNode

    expect(copiedElement.location).toBe(element.location)
    expect(copiedElement.open_tag!.tag_name!.location).toBe(element.open_tag!.tag_name!.location)
  })

  test("copies tokens, which consumers write to", () => {
    const node = parse("<DIV>Content</DIV>")
    const copy = cloneNode(node)

    const element = node.compactChildNodes()[0] as HTMLElementNode
    const copiedElement = copy.compactChildNodes()[0] as HTMLElementNode

    const tagName = element.open_tag!.tag_name!
    const copiedTagName = copiedElement.open_tag!.tag_name!

    expect(copiedTagName).not.toBe(tagName)
    expect(copiedTagName.value).toBe(tagName.value)

    ;(copiedTagName as any).value = "div"

    expect(tagName.value).toBe("DIV")
  })

  test("keeps the source available on copied nodes", () => {
    const node = parse('<div><%= "Content" %></div>', { prism_nodes: true })
    const copy = cloneNode(node)

    expect(node.source).not.toBeNull()
    expect(copy.source).toBe(node.source)
    expect(copy.compactChildNodes()[0].source).toBe(node.compactChildNodes()[0].source)
  })

  test("mutating the copy leaves the original untouched", () => {
    const node = parse("<div>Content</div>")
    const copy = cloneNode(node)

    const element = copy.compactChildNodes()[0] as HTMLElementNode

    ;(element as any).element_source = "MUTATED"
    ;(element as any).body = []

    expect((node.compactChildNodes()[0] as HTMLElementNode).element_source).not.toBe("MUTATED")
    expect((node.compactChildNodes()[0] as HTMLElementNode).body.length).toBe(1)
  })
})

describe("rewriting a copy leaves the input node untouched", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("ActionViewTagHelperToHTMLRewriter", () => {
    const node = parse('<%= link_to "Edit", edit_path %>', { action_view_helpers: true })
    const rewritten = rewriteCopy(new ActionViewTagHelperToHTMLRewriter(), node)

    expect(IdentityPrinter.print(rewritten)).toBe('<a href="<%= edit_path %>">Edit</a>')
  })

  test("ActionViewTagHelperToHTMLRewriter with shallow", () => {
    const source = dedent`
      <div class='x'>
        <% if user.admin? %>
          <%= link_to "E", p %>
        <% end %>
      </div>
    `

    const node = parse(source, { action_view_helpers: true })

    rewriteCopy(new ActionViewTagHelperToHTMLRewriter(), node, { baseDir: process.cwd(), shallow: true })
  })

  test("ActionViewTagHelperToHTMLRewriter can be run repeatedly on the same tree", () => {
    const node = parse('<%= tag.div class: "one" do %>Content<% end %>', { action_view_helpers: true })
    const rewriter = new ActionViewTagHelperToHTMLRewriter()
    const context = { baseDir: process.cwd(), shallow: true }

    const first = IdentityPrinter.print(rewriter.rewrite(cloneNode(node), context))
    const second = IdentityPrinter.print(rewriter.rewrite(cloneNode(node), context))

    expect(second).toBe(first)
  })

  test("HTMLToActionViewTagHelperRewriter", () => {
    const node = parse('<div class="one">Content</div>')
    const rewritten = rewriteCopy(new HTMLToActionViewTagHelperRewriter(), node)

    expect(IdentityPrinter.print(rewritten)).toBe('<%= tag.div "Content", class: "one" %>')
  })

  test("ERBStringToDirectOutputRewriter", () => {
    const node = parse('<p><%= "Title" %></p>', { prism_nodes: true })
    const rewritten = rewriteCopy(new ERBStringToDirectOutputRewriter(), node)

    expect(IdentityPrinter.print(rewritten)).toBe("<p>Title</p>")
  })
})
