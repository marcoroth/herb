import { Visitor, Location, ERBOpenTagNode, ERBEndNode, HTMLElementNode, HTMLVirtualCloseTagNode, createSyntheticToken } from "@herb-tools/core"
import { getStaticAttributeName, isLiteralNode, isHTMLOpenTagNode, isHTMLTextNode, isHTMLAttributeNode, isERBContentNode, isWhitespaceNode } from "@herb-tools/core"

import { ASTRewriter } from "../ast-rewriter.js"
import { asMutable } from "../mutable.js"

import type { RewriteContext } from "../context.js"
import type { Node, HTMLAttributeValueNode } from "@herb-tools/core"

function serializeAttributeValue(value: HTMLAttributeValueNode): string {
  const hasERB = value.children.some(child => isERBContentNode(child))

  if (hasERB && value.children.length === 1 && isERBContentNode(value.children[0])) {
    return value.children[0].content?.value?.trim() ?? '""'
  }

  const parts: string[] = []

  for (const child of value.children) {
    if (isLiteralNode(child)) {
      parts.push(child.content)
    } else if (isERBContentNode(child)) {
      parts.push(`#{${child.content?.value?.trim() ?? ""}}`)
    }
  }

  return `"${parts.join("")}"`
}

function dashToUnderscore(string: string): string {
  return string.replace(/-/g, "_")
}

interface SerializedAttributes {
  attributes: string
  href: string | null
  id: string | null
  src: string | null
}

function serializeAttributes(children: Node[], options: { extractHref?: boolean, extractId?: boolean, extractSrc?: boolean } = {}): SerializedAttributes {
  const regular: string[] = []
  const prefixed: Map<string, string[]> = new Map()

  let href: string | null = null
  let id: string | null = null
  let src: string | null = null

  for (const child of children) {
    if (!isHTMLAttributeNode(child)) continue

    const name = getStaticAttributeName(child.name!)
    if (!name) continue

    const value = child.value ? serializeAttributeValue(child.value) : "true"

    if (options.extractHref && name === "href") {
      href = value
      continue
    }

    if (options.extractId && name === "id") {
      id = value
      continue
    }

    if (options.extractSrc && name === "src") {
      src = value
      continue
    }

    const dataMatch = name.match(/^(data|aria)-(.+)$/)

    if (dataMatch) {
      const [, prefix, rest] = dataMatch

      if (!prefixed.has(prefix)) {
        prefixed.set(prefix, [])
      }

      prefixed.get(prefix)!.push(`${dashToUnderscore(rest)}: ${value}`)
    } else {
      regular.push(`${name}: ${value}`)
    }
  }

  const parts = [...regular]

  for (const [prefix, entries] of prefixed) {
    parts.push(`${prefix}: { ${entries.join(", ")} }`)
  }

  return { attributes: parts.join(", "), href, id, src }
}

function isTextOnlyBody(body: Node[]): boolean {
  if (body.length !== 1 || !isHTMLTextNode(body[0])) return false

  return !body[0].content.includes("\n")
}

class HTMLToActionViewTagHelperVisitor extends Visitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    const openTag = node.open_tag

    if (!isHTMLOpenTagNode(openTag)) {
      this.visitChildNodes(node)
      return
    }

    const tagName = openTag.tag_name

    if (!tagName) {
      this.visitChildNodes(node)
      return
    }

    if (node.body) {
      for (const child of node.body) {
        this.visit(child)
      }
    }

    const isAnchor = tagName.value === "a"
    const isTurboFrame = tagName.value === "turbo-frame"
    const isScript = tagName.value === "script"
    const attributes = openTag.children.filter(child => !isWhitespaceNode(child))
    const hasSrcAttribute = isScript && attributes.some(child => isHTMLAttributeNode(child) && getStaticAttributeName(child.name!) === "src")
    const { attributes: attributesString, href, id, src } = serializeAttributes(attributes, { extractHref: isAnchor, extractId: isTurboFrame, extractSrc: isScript })
    const hasBody = node.body && node.body.length > 0 && !node.is_void
    const isInlineContent = hasBody && isTextOnlyBody(node.body)

    let content: string
    let elementSource: string

    if (isAnchor) {
      content = this.buildLinkToContent(node, attributesString, href, isInlineContent)
      elementSource = "ActionView::Helpers::UrlHelper#link_to"
    } else if (isTurboFrame) {
      content = this.buildTurboFrameTagContent(node, attributesString, id, isInlineContent)
      elementSource = "Turbo::FramesHelper#turbo_frame_tag"
    } else if (isScript && hasSrcAttribute) {
      content = this.buildJavascriptIncludeTagContent(attributesString, src)
      elementSource = "ActionView::Helpers::AssetTagHelper#javascript_include_tag"
    } else if (isScript) {
      content = this.buildJavascriptTagContent(node, attributesString, isInlineContent)
      elementSource = "ActionView::Helpers::JavaScriptHelper#javascript_tag"
    } else {
      content = this.buildTagContent(tagName.value, node, attributesString, isInlineContent)
      elementSource = "ActionView::Helpers::TagHelper#tag"
    }

    const erbOpenTag = new ERBOpenTagNode({
      type: "AST_ERB_OPEN_TAG_NODE",
      location: openTag.location,
      errors: [],
      tag_opening: createSyntheticToken("<%="),
      content: createSyntheticToken(content),
      tag_closing: createSyntheticToken("%>"),
      tag_name: createSyntheticToken(tagName.value),
      children: [],
    })

    asMutable(node).open_tag = erbOpenTag
    asMutable(node).element_source = elementSource

    const isInlineLiteralContent = isScript && hasBody && node.body.length === 1 && isLiteralNode(node.body[0]) && !node.body[0].content.includes("\n")
    const isInlineForm = isInlineContent || isInlineLiteralContent || (isTurboFrame && !hasBody) || (isScript && hasSrcAttribute)

    if (node.is_void) {
      asMutable(node).close_tag = null
    } else if (isInlineForm) {
      asMutable(node).body = []

      const virtualClose = new HTMLVirtualCloseTagNode({
        type: "AST_HTML_VIRTUAL_CLOSE_TAG_NODE",
        location: Location.zero,
        errors: [],
        tag_name: createSyntheticToken(tagName.value),
      })

      asMutable(node).close_tag = virtualClose
    } else if (node.close_tag) {
      const erbEnd = new ERBEndNode({
        type: "AST_ERB_END_NODE",
        location: node.close_tag.location,
        errors: [],
        tag_opening: createSyntheticToken("<%"),
        content: createSyntheticToken(" end "),
        tag_closing: createSyntheticToken("%>"),
      })

      asMutable(node).close_tag = erbEnd
    }
  }

  private buildTagContent(tag: string, node: HTMLElementNode, attributes: string, isInlineContent: boolean): string {
    const methodName = dashToUnderscore(tag)

    if (node.is_void) {
      return attributes
        ? ` tag.${methodName} ${attributes} `
        : ` tag.${methodName} `
    }

    if (isInlineContent && isHTMLTextNode(node.body[0])) {
      const textContent = node.body[0].content

      return attributes
        ? ` tag.${methodName} "${textContent}", ${attributes} `
        : ` tag.${methodName} "${textContent}" `
    }

    return attributes
      ? ` tag.${methodName} ${attributes} do `
      : ` tag.${methodName} do `
  }

  private buildTurboFrameTagContent(node: HTMLElementNode, attributes: string, id: string | null, isInlineContent: boolean): string {
    const args: string[] = []

    if (id) {
      args.push(id)
    }

    if (isInlineContent && isHTMLTextNode(node.body[0])) {
      args.push(`"${node.body[0].content}"`)
    }

    if (attributes) {
      args.push(attributes)
    }

    const argString = args.join(", ")

    if (isInlineContent || !node.body || node.body.length === 0) {
      return argString ? ` turbo_frame_tag ${argString} ` : ` turbo_frame_tag `
    }

    return argString ? ` turbo_frame_tag ${argString} do ` : ` turbo_frame_tag do `
  }

  private buildJavascriptTagContent(node: HTMLElementNode, attributes: string, isInlineContent: boolean): string {
    const bodyNode = node.body?.[0]
    const isInlineLiteral = bodyNode && isLiteralNode(bodyNode) && !bodyNode.content.includes("\n")
    const isInlineText = isInlineContent && isHTMLTextNode(bodyNode)

    if (isInlineText || isInlineLiteral) {
      const textContent = isHTMLTextNode(bodyNode) ? bodyNode.content : bodyNode.content
      const args = [`"${textContent}"`]

      if (attributes) args.push(attributes)

      return ` javascript_tag ${args.join(", ")} `
    }

    return attributes
      ? ` javascript_tag ${attributes} do `
      : ` javascript_tag do `
  }

  private buildJavascriptIncludeTagContent(attributes: string, source: string | null): string {
    const args: string[] = []

    if (source) args.push(source)
    if (attributes) args.push(attributes)

    const argString = args.join(", ")

    return argString ? ` javascript_include_tag ${argString} ` : ` javascript_include_tag `
  }

  private buildLinkToContent(node: HTMLElementNode, attribute: string, href: string | null, isInlineContent: boolean): string {
    const args: string[] = []

    if (isInlineContent && isHTMLTextNode(node.body[0])) {
      args.push(`"${node.body[0].content}"`)
    }

    if (href) {
      args.push(href)
    }

    if (attribute) {
      args.push(attribute)
    }

    const argString = args.join(", ")

    if (isInlineContent) {
      return argString ? ` link_to ${argString} ` : ` link_to `
    }

    return argString ? ` link_to ${argString} do ` : ` link_to do `
  }
}

export class HTMLToActionViewTagHelperRewriter extends ASTRewriter {
  get name(): string {
    return "html-to-action-view-tag-helper"
  }

  get description(): string {
    return "Converts raw HTML elements to ActionView tag helpers (tag.*, turbo_frame_tag, javascript_tag, javascript_include_tag)"
  }

  rewrite<T extends Node>(node: T, _context: RewriteContext): T {
    const visitor = new HTMLToActionViewTagHelperVisitor()

    visitor.visit(node)

    return node
  }
}
