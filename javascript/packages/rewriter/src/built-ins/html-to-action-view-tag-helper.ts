import { Visitor, ERBOpenTagNode, ERBEndNode, HTMLElementNode, HTMLVirtualCloseTagNode, Token, findPreferredHelperForTag, HELPER_REGISTRY } from "@herb-tools/core"
import { getStaticAttributeName, isLiteralNode, isHTMLOpenTagNode, isHTMLTextNode, isHTMLAttributeNode, isERBContentNode, isERBOutputNode, isWhitespaceNode } from "@herb-tools/core"

import { ASTRewriter } from "../ast-rewriter.js"
import { asMutable } from "../mutable.js"

import type { RewriteContext } from "../context.js"
import type { Node, HTMLAttributeValueNode } from "@herb-tools/core"

const ENTITY_REFERENCE = /&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/

const OPENING_BRACKETS = new Set(["(", "[", "{"])
const CLOSING_BRACKETS = new Set([")", "]", "}"])
const WHITESPACE = new Set([" ", "\t", "\n", "\r", "\f", "\v"])

const RUBY_LABEL = /^[a-z_][a-z0-9_]*$/

// TODO: extract to config/
const BOOLEAN_ATTRIBUTES = new Set(["allowfullscreen", "async", "autobuffer", "autofocus", "autoplay", "checked", "controls", "default", "defer", "disabled", "formnovalidate", "hidden", "inert", "ismap", "itemscope", "loop", "multiple", "muted", "novalidate", "open", "pubdate", "readonly", "required", "reversed", "scoped", "seamless", "selected", "sortable", "truespeed", "typemustmatch"])

export interface SerializedAttributes {
  attributes: string
  href: string | null
  id: string | null
  src: string | null
  rel: string | null
}

function hasTopLevelWhitespace(expression: string): boolean {
  let depth = 0
  let quote: string | null = null

  for (let index = 0; index < expression.length; index++) {
    const character = expression[index]

    if (quote) {
      if (character === "\\") index++
      else if (character === quote) quote = null

      continue
    }

    if (character === '"' || character === "'") quote = character
    else if (OPENING_BRACKETS.has(character)) depth++
    else if (CLOSING_BRACKETS.has(character)) depth--
    else if (depth === 0 && WHITESPACE.has(character)) return true
  }

  return false
}

function escapeForDoubleQuotedString(content: string): string {
  return content.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/#(?=[{@$])/g, "\\#")
}

function serializeExpression(node: Node): string | null {
  if (!isERBContentNode(node)) return null
  if (!isERBOutputNode(node)) return null

  const expression = node.content?.value?.trim() ?? ""

  return expression === "" ? null : expression
}

function serializeAttributeValue(value: HTMLAttributeValueNode): string | null {
  const children = value.children ?? []

  if (children.length === 1 && isERBContentNode(children[0])) {
    const expression = serializeExpression(children[0])
    if (!expression) return null

    return hasTopLevelWhitespace(expression) ? `(${expression})` : expression
  }

  const parts: string[] = []

  for (const child of children) {
    if (isLiteralNode(child)) {
      if (ENTITY_REFERENCE.test(child.content)) return null

      parts.push(escapeForDoubleQuotedString(child.content))

      continue
    }

    const expression = serializeExpression(child)
    if (!expression) return null

    parts.push(`#{${expression}}`)
  }

  return `"${parts.join("")}"`
}

function dashToUnderscore(string: string): string {
  return string.replace(/-/g, "_")
}

function getStaticAttributeValue(children: Node[], attributeName: string): string | null {
  for (const child of children) {
    if (!isHTMLAttributeNode(child)) continue
    if (getStaticAttributeName(child.name!) !== attributeName) continue
    if (!child.value) return null
    if (!child.value.children.every(value => isLiteralNode(value))) return null

    return child.value.children.map(value => isLiteralNode(value) ? value.content : "").join("")
  }

  return null
}

export function serializeTagHelperAttributes(children: Node[], options: { extractHref?: boolean, extractId?: boolean, extractSrc?: boolean, extractRel?: boolean } = {}): SerializedAttributes | null {
  const regular: string[] = []
  const prefixed: Map<string, string[]> = new Map()
  const seen = new Set<string>()

  let href: string | null = null
  let id: string | null = null
  let src: string | null = null
  let rel: string | null = null

  for (const child of children) {
    if (!isHTMLAttributeNode(child)) return null

    const name = getStaticAttributeName(child.name!)?.toLowerCase()

    if (!name) return null

    if (seen.has(name)) return null

    seen.add(name)

    if (!child.value && !BOOLEAN_ATTRIBUTES.has(name)) return null

    const value = child.value ? serializeAttributeValue(child.value) : "true"

    if (!value) return null

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

    if (options.extractRel && name === "rel") {
      rel = value
      continue
    }

    const dataMatch = name.match(/^(data|aria)-(.+)$/)

    if (dataMatch) {
      const [, prefix, rest] = dataMatch
      const key = dashToUnderscore(rest)

      if (!RUBY_LABEL.test(key)) return null

      if (!prefixed.has(prefix)) {
        prefixed.set(prefix, [])
      }

      prefixed.get(prefix)!.push(`${key}: ${value}`)
    } else if (!RUBY_LABEL.test(name)) {
      return null
    } else {
      regular.push(`${name}: ${value}`)
    }
  }

  const parts = [...regular]

  for (const [prefix, entries] of prefixed) {
    parts.push(`${prefix}: { ${entries.join(", ")} }`)
  }

  return { attributes: parts.join(", "), href, id, src, rel }
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

    const preferredHelper = findPreferredHelperForTag(tagName.value)
    const attributes = openTag.children.filter(child => !isWhitespaceNode(child))
    const implicitAttrName = preferredHelper?.implicitAttribute?.name
    const hasSrcAttribute = attributes.some(child => isHTMLAttributeNode(child) && getStaticAttributeName(child.name!) === "src")
    const hasHrefAttribute = attributes.some(child => isHTMLAttributeNode(child) && getStaticAttributeName(child.name!) === "href")
    const isStylesheetLink = tagName.value === "link" && hasHrefAttribute && getStaticAttributeValue(attributes, "rel") === "stylesheet"
    const serialized = serializeTagHelperAttributes(attributes, {
      extractHref: implicitAttrName === "href" || isStylesheetLink,
      extractId: implicitAttrName === "id",
      extractSrc: implicitAttrName === "src" || tagName.value === "script",
      extractRel: isStylesheetLink,
    })

    if (!serialized) return

    const { attributes: attributesString, href, id, src } = serialized
    const hasBody = node.body && node.body.length > 0 && !node.is_void
    const isInlineContent = hasBody && isTextOnlyBody(node.body)

    let content: string
    let elementSource: string

    if (preferredHelper?.name === "link_to") {
      content = this.buildLinkToContent(node, attributesString, href, isInlineContent)
      elementSource = preferredHelper.source
    } else if (preferredHelper?.name === "turbo_frame_tag") {
      content = this.buildTurboFrameTagContent(node, attributesString, id, isInlineContent)
      elementSource = preferredHelper.source
    } else if (preferredHelper?.name === "image_tag") {
      content = this.buildImageTagContent(attributesString, src)
      elementSource = preferredHelper.source
    } else if (isStylesheetLink) {
      content = this.buildStylesheetLinkTagContent(attributesString, href)
      elementSource = HELPER_REGISTRY["stylesheet_link_tag"].source
    } else if (tagName.value === "script" && hasSrcAttribute) {
      content = this.buildJavascriptIncludeTagContent(attributesString, src)
      elementSource = HELPER_REGISTRY["javascript_include_tag"].source
    } else if (tagName.value === "script") {
      content = this.buildJavascriptTagContent(node, attributesString, isInlineContent)
      elementSource = HELPER_REGISTRY["javascript_tag"].source
    } else {
      content = this.buildTagContent(tagName.value, node, attributesString, isInlineContent)
      elementSource = HELPER_REGISTRY["tag"].source
    }

    const erbOpenTag = ERBOpenTagNode.build({
      location: openTag.location,
      tag_opening: Token.from("TOKEN_ERB_START", "<%="),
      content: Token.from("TOKEN_ERB_CONTENT", content),
      tag_closing: Token.from("TOKEN_ERB_END", "%>"),
      tag_name: Token.from("TOKEN_IDENTIFIER", tagName.value),
    })

    asMutable(node).open_tag = erbOpenTag
    asMutable(node).element_source = elementSource

    const isScript = tagName.value === "script"
    const isInlineLiteralContent = isScript && hasBody && node.body.length === 1 && isLiteralNode(node.body[0]) && !node.body[0].content.includes("\n")
    const isVoidHelper = preferredHelper?.isVoid ?? node.is_void
    const isInlineForm = isInlineContent || isInlineLiteralContent || isVoidHelper || (preferredHelper?.name === "turbo_frame_tag" && !hasBody) || (isScript && hasSrcAttribute)

    if (node.is_void) {
      asMutable(node).close_tag = null
    } else if (isInlineForm) {
      asMutable(node).body = []

      const virtualClose = HTMLVirtualCloseTagNode.build({
        tag_name: Token.from("TOKEN_IDENTIFIER", tagName.value),
      })

      asMutable(node).close_tag = virtualClose
    } else if (node.close_tag) {
      const erbEnd = ERBEndNode.build({
        location: node.close_tag.location,
        tag_opening: Token.from("TOKEN_ERB_START", "<%"),
        content: Token.from("TOKEN_ERB_CONTENT", " end "),
        tag_closing: Token.from("TOKEN_ERB_END", "%>"),
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

  private buildImageTagContent(attributes: string, source: string | null): string {
    const args: string[] = []

    if (source) args.push(source)
    if (attributes) args.push(attributes)

    const argString = args.join(", ")

    return argString ? ` image_tag ${argString} ` : ` image_tag `
  }

  private buildStylesheetLinkTagContent(attributes: string, source: string | null): string {
    const args: string[] = []

    if (source) args.push(source)
    if (attributes) args.push(attributes)

    const argString = args.join(", ")

    return argString ? ` stylesheet_link_tag ${argString} ` : ` stylesheet_link_tag `
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
    return "Converts raw HTML elements to ActionView tag helpers (tag.*, turbo_frame_tag, javascript_tag, javascript_include_tag, image_tag, stylesheet_link_tag)"
  }

  rewrite<T extends Node>(node: T, _context: RewriteContext): T {
    const visitor = new HTMLToActionViewTagHelperVisitor()

    visitor.visit(node)

    return node
  }
}
