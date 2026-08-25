import { Hover, MarkupKind, Position, Range } from "vscode-languageserver-types"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Visitor } from "@herb-tools/core"
import { IdentityPrinter } from "@herb-tools/printer"
import { ActionViewTagHelperToHTMLRewriter, cloneNode } from "@herb-tools/rewriter"
import { isERBOpenTagNode, isHTMLElementNode, isERBContentNode, getNamedCharacterReference, getTagLocalName, hasAttribute, getAttribute, HELPER_BY_SOURCE, HELPER_REGISTRY, CHARACTER_REFERENCE_PATTERN } from "@herb-tools/core"
import { ParserService } from "./parser_service"
import { lspPosition, isPositionInRange, rangeSize, hasSourceLocation, nodeToRange } from "./range_utils"
import { RubyLocalsIndex } from "./ruby_locals_index"
import { collectStateDirectives } from "./herb_attribute_links"

import type { DocumentNode } from "@herb-tools/core"

import type { Node, HTMLElementNode, ERBOpenTagNode, ERBContentNode, HTMLCharacterReference, HelperEntry } from "@herb-tools/core"
import type { FrameworkOptions } from "./types.js"

class ActionViewElementCollector extends Visitor {
  public elements: { node: HTMLElementNode; openTag: ERBOpenTagNode; range: Range }[] = []

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (node.element_source && node.element_source !== "HTML" && isERBOpenTagNode(node.open_tag)) {
      const content = node.open_tag.content
      const tagName = node.open_tag.tag_name

      if (content && tagName && hasSourceLocation(content.location)) {
        const isTagHelper = node.element_source === "ActionView::Helpers::TagHelper#tag"
        const methodName = isTagHelper ? `tag.${tagName.value}` : node.element_source.split("#").pop()!

        const offset = content.value.indexOf(methodName)

        if (offset !== -1) {
          const contentStart = lspPosition(content.location.start)
          const start = Position.create(contentStart.line, contentStart.character + offset)
          const end = Position.create(start.line, start.character + methodName.length)

          this.elements.push({
            node,
            openTag: node.open_tag,
            range: Range.create(start, end),
          })
        }
      }
    }

    this.visitChildNodes(node)
  }
}

interface ERBHelperMatch {
  node: ERBContentNode
  helper: HelperEntry
  range: Range
}

class ERBHelperCollector extends Visitor {
  public matches: ERBHelperMatch[] = []

  visitERBContentNode(node: ERBContentNode): void {
    this.scanContentToken(node, node.content)
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    // Scan transformed action view helper open tags for nested helper calls
    // e.g. turbo_frame_tag dom_id(user) → scan for dom_id inside the content
    if (isERBOpenTagNode(node.open_tag)) {
      this.scanContentToken(node.open_tag, node.open_tag.content)
    }

    this.visitChildNodes(node)
  }

  private scanContentToken(node: ERBContentNode | ERBOpenTagNode, contentToken: { value: string; location: { start: { line: number; column: number } } } | null | undefined): void {
    if (!contentToken?.value) return
    if (!hasSourceLocation(contentToken.location)) return

    const value = contentToken.value
    const contentStart = lspPosition(contentToken.location.start)

    // Find all method calls that match registered helpers.
    // Matches: dom_id(, truncate(, link_to , csrf_meta_tags etc.
    const pattern = /\b(\w+[?!]?)\s*[(\s,]/g
    let match: RegExpExecArray | null

    while ((match = pattern.exec(value)) !== null) {
      const methodName = match[1]
      const helper = HELPER_REGISTRY[methodName]
      if (!helper) continue

      const offset = match.index
      const start = Position.create(contentStart.line, contentStart.character + offset)
      const end = Position.create(start.line, start.character + methodName.length)

      this.matches.push({ node: node as any, helper, range: Range.create(start, end) })
    }

    // Also match helpers at the end of content (no trailing paren/space),
    // e.g. "<%= csrf_meta_tags %>"
    const trailingMatch = value.match(/\b(\w+[?!]?)\s*$/)
    if (trailingMatch) {
      const methodName = trailingMatch[1]
      const helper = HELPER_REGISTRY[methodName]

      if (helper) {
        const offset = value.lastIndexOf(methodName)
        const start = Position.create(contentStart.line, contentStart.character + offset)
        const end = Position.create(start.line, start.character + methodName.length)

        const alreadyMatched = this.matches.some(m =>
          m.range.start.character === start.character && m.range.start.line === start.line
        )

        if (!alreadyMatched) {
          this.matches.push({ node: node as any, helper, range: Range.create(start, end) })
        }
      }
    }
  }
}

function dedent(text: string): string {
  const lines = text.split("\n")
  const indents = lines.filter(line => line.trim().length > 0).map(line => line.match(/^(\s*)/)?.[1].length ?? 0)
  const minIndent = Math.min(...indents)

  if (minIndent === 0) return text

  return lines.map(line => line.slice(minIndent)).join("\n")
}

function blockParameter(scope: Node): string | null {
  const content = (scope as { content?: { value?: string } }).content?.value ?? ""
  const match = content.match(/\|\s*([A-Za-z_][A-Za-z0-9_]*)/)

  return match ? match[1] : null
}

function declaredStateKind(kind: string): string {
  return ["boolean", "integer", "string", "symbol", "nil"].includes(kind) ? kind : "seeded"
}

function stateUsageLines(name: string, kind: string, defaultSource: string, derived = false): string[] {
  const fence = (language: string, ...lines: string[]) => ["```" + language, ...lines, "```"]

  if (derived) {
    const read = kind === "boolean" ? `<% if ${name} %>` : `<% if ${name} == ${defaultSource || "..."} %>`

    return [
      ...fence("erb", `<%= ${name} %>`, read),
      "",
      ...fence("javascript", `stateFor(element).get("${name}")`),
    ]
  }

  if (kind === "boolean") {
    return [
      ...fence("erb", `<%= ${name} %>`, `<% if ${name}? %>`, `<button data-herb-toggle="${name}">`),
      "",
      ...fence("javascript", `stateFor(element).set({ ${name}: true })`),
    ]
  }

  if (kind === "integer") {
    return [
      ...fence("erb", `<%= ${name} %>`, `<% if ${name} == ${defaultSource || "0"} %>`, `<button data-herb-increment="${name}">`),
      "",
      ...fence("javascript", `stateFor(element).set({ ${name}: ${defaultSource || "0"} })`),
    ]
  }

  if (kind === "string" || kind === "symbol") {
    return [
      ...fence("erb", `<%= ${name} %>`, `<% if ${name} == ${defaultSource || '""'} %>`, `<button data-herb-set="${name}=...">`, `<button data-herb-reset="${name}">`),
      "",
      ...fence("javascript", `stateFor(element).set({ ${name}: ${defaultSource || '"..."'} })`),
    ]
  }

  return [
    ...fence("erb", `<%= ${name} %>`, `<% if ${name} %>`),
    "",
    ...fence("javascript", `stateFor(element).set({ ${name}: value })`),
  ]
}

const SCOPED_STYLE_DOC = dedent(`
  **\`<style scoped>\`** · Herb Engine

  This block's CSS applies only to the markup in this file, like scoped styles in Vue and Svelte components. Herb marks the file's elements with a scope attribute and narrows the block's selectors to require it.

  Example:

  \`\`\`html
  <style scoped>
    .title {
      color: red;
    }
  </style>

  <h1 class="title">Hi</h1>
  \`\`\`

  becomes

  \`\`\`html
  <style>
    .title:where([data-herb-scope-1a2b3c4d], [data-herb-scope-1a2b3c4d] *) {
      color: red;
    }
  </style>

  <h1 class="title" data-herb-scope-1a2b3c4d>Hi</h1>
  \`\`\`

  [Scoped styles](https://herb-tools.dev/projects/engine#scopedstyle-visitor)
`).trim()

class ScopedStyleCollector extends Visitor {
  readonly found: Range[] = []

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (getTagLocalName(node) === "style" && hasAttribute(node, "scoped")) {
      const attribute = getAttribute(node, "scoped")

      if (attribute && hasSourceLocation(attribute.location)) {
        this.found.push(nodeToRange(attribute))
      }
    }

    this.visitChildNodes(node)
  }
}

const DIRECTIVE_DOCS: Record<string, string> = {
  "herb:slots": [
    "**herb:slots** · Herb directive",
    "",
    "Chooses who renders this template's dynamic parts. `server` keeps every update a round trip. `client` also ships the markup that did not render, untaken branches and an empty collection row, parked in a `<template>`, so a branch can switch or a row can be inserted without asking the server.",
    "",
    "Example usage:",
    "",
    "```erb",
    "<%# herb:slots client %>",
    "```",
  ].join("\n"),
  "herb:state": [
    "**herb:state** · Herb directive",
    "",
    "Declares client-owned state with the strict-locals signature. The server renders each default, and every read updates in place when the client writes. Placement scopes it, at the top of the template it is one value per rendering, inside a keyed loop one value per item.",
    "",
    "Example usage:",
    "",
    "```erb",
    '<%# herb:state (pending: false, draft: "") %>',
    "```",
  ].join("\n"),
  "herb:key": [
    "**herb:key** · Herb directive",
    "",
    "Keys each item of the enclosing collection by an expression, so the client can add, remove, re-key, and reorder rows without rebuilding them. A dynamic \`id\` or \`herb-key\` attribute on the item's root element keys it the same way, so the directive is only needed when the row has neither.",
    "",
    "Example usage:",
    "",
    "```erb",
    "<%# herb:key message.id %>",
    "```",
    "",
    "Keyed by its \`id\` instead, with no directive:",
    "",
    "```erb",
    '<li id="<%= dom_id(message) %>">',
    "```",
  ].join("\n"),
}

const DIRECTIVE_KEYWORD = /herb:(?:state|slots|key)\b/

class DirectiveKeywordCollector extends Visitor {
  readonly found: { node: ERBContentNode, keyword: string, offset: number }[] = []

  visitChildNodes(node: Node): void {
    if (isERBContentNode(node) && node.tag_opening?.value === "<%#") {
      const content = node.content?.value ?? ""
      const match = DIRECTIVE_KEYWORD.exec(content)

      if (match) this.found.push({ node, keyword: match[0], offset: match.index })
    }

    super.visitChildNodes(node)
  }
}

function contentTokenRange(node: ERBContentNode, offset: number, length: number): Range {
  const content = node.content

  if (!content) return Range.create(lspPosition(node.location.start), lspPosition(node.location.end))

  const before = content.value.slice(0, offset)
  const lines = before.split("\n")
  const line = content.location.start.line + lines.length - 1
  const column = lines.length === 1 ? content.location.start.column + before.length : lines[lines.length - 1].length
  const from = lspPosition({ line, column })

  return Range.create(from, Position.create(from.line, from.character + length))
}

export class HoverProvider {
  private parserService: ParserService

  private readonly baseDir: string

  constructor(parserService: ParserService, baseDir: string = ".") {
    this.parserService = parserService
    this.baseDir = baseDir
  }

  private getDirectiveHover(textDocument: TextDocument, position: Position): Hover | null {
    const parsed = this.parserService.parseContent(textDocument.getText(), { track_whitespace: true })
    const collector = new DirectiveKeywordCollector()

    collector.visit(parsed.value)

    for (const { node, keyword, offset } of collector.found) {
      const range = contentTokenRange(node, offset, keyword.length)

      if (!isPositionInRange(position, range)) continue

      const documentation = DIRECTIVE_DOCS[keyword]

      if (!documentation) continue

      return { contents: { kind: MarkupKind.Markdown, value: documentation }, range }
    }

    return null
  }

  private getStateHover(textDocument: TextDocument, position: Position): Hover | null {
    const index = RubyLocalsIndex.build(this.parserService, textDocument)
    const local = index.at(position)

    if (!local) return null

    const parsed = this.parserService.parseContent(textDocument.getText(), { prism_program: true, strict_locals: true })
    const entries = collectStateDirectives(parsed.value as DocumentNode).filter(entry =>
      entry.signature.declarations.some(declaration => declaration.name === local.name),
    )

    if (entries.length === 0) return null

    const scoped = entries.find(entry => entry.scope !== null && isPositionInRange(position, nodeToRange(entry.scope)))
    const entry = scoped ?? entries.find(candidate => candidate.scope === null) ?? entries[0]
    const declaration = entry.signature.declarations.find(candidate => candidate.name === local.name)

    if (!declaration) return null

    const derived = declaration.derived !== undefined && declaration.derived !== null && typeof declaration.derived === "object" ? declaration.derived : null
    const kind = derived ? derived.kind : declaredStateKind(declaration.kind)
    const parameter = entry.scope === null ? null : blockParameter(entry.scope)
    const scope = entry.scope === null
      ? "one value per rendering"
      : `one value for each \`${parameter ?? "item"}\``

    const source = derived
      ? `derived from \`${declaration.defaultSource}\``
      : `default \`${declaration.defaultSource || "(none)"}\``

    const lines = [
      `**${declaration.name}** · Herb Client State`,
      "",
      `\`${kind}\` · ${source} · ${scope}`,
      "",
      "Example usage:",
      "",
      ...stateUsageLines(declaration.name, kind, derived ? "" : declaration.defaultSource, derived !== null),
    ]

    const range = [local.declaration, ...(local.defaultValue ? [local.defaultValue] : []), ...local.usages]
      .find(candidate => isPositionInRange(position, candidate))

    return {
      contents: { kind: MarkupKind.Markdown, value: lines.join("\n") },
      range,
    }
  }

  private getScopedStyleHover(textDocument: TextDocument, position: Position): Hover | null {
    const parsed = this.parserService.parseContent(textDocument.getText(), { track_whitespace: true })
    const collector = new ScopedStyleCollector()

    collector.visit(parsed.value)

    for (const range of collector.found) {
      if (isPositionInRange(position, range)) {
        return { contents: { kind: MarkupKind.Markdown, value: SCOPED_STYLE_DOC }, range }
      }
    }

    return null
  }

  getHover(textDocument: TextDocument, position: Position, options?: FrameworkOptions): Hover | null {
    const state = this.getStateHover(textDocument, position)
    if (state) return state

    const directive = this.getDirectiveHover(textDocument, position)
    if (directive) return directive

    const scopedStyle = this.getScopedStyleHover(textDocument, position)
    if (scopedStyle) return scopedStyle

    if (options?.framework !== "actionview") {
      return this.getEntityHover(textDocument, position)
    }

    const parseResult = this.parserService.parseContent(textDocument.getText(), {
      action_view_helpers: true,
      track_whitespace: true,
    })

    const collector = new ActionViewElementCollector()
    collector.visit(parseResult.value)

    let bestElement: { node: HTMLElementNode; openTag: ERBOpenTagNode; range: Range } | null = null
    let bestSize = Infinity

    for (const element of collector.elements) {
      if (isPositionInRange(position, element.range)) {
        const size = rangeSize(element.range)

        if (size < bestSize) {
          bestSize = size
          bestElement = element
        }
      }
    }

    // Check for nested helper calls (e.g. dom_id inside turbo_frame_tag).
    // Only use the ERB helper hover if it matches a DIFFERENT range than the
    // outer action view element — meaning the cursor is on a nested call,
    // not on the outer helper name itself.
    const erbHelperHover = this.getERBHelperHover(parseResult.value, position)

    if (!bestElement) {
      return erbHelperHover ?? this.getEntityHover(textDocument, position)
    }

    if (erbHelperHover && !this.rangesEqual(erbHelperHover.range!, bestElement.range)) {
      return erbHelperHover
    }

    const parts: string[] = []

    const elementSource = bestElement.node.element_source
    const isLeaf = !bestElement.node.body.some(child => isHTMLElementNode(child))
    const helper = HELPER_BY_SOURCE[elementSource]

    if (helper) {
      parts.push(`\`\`\`ruby\n${helper.signature}\n\`\`\``)

      if (helper.description) {
        parts.push(helper.description)
      }
    }

    if (isLeaf) {
      const rewriter = new ActionViewTagHelperToHTMLRewriter()
      const rewrittenNode = rewriter.rewrite(cloneNode(bestElement.node), { baseDir: this.baseDir, shallow: true })
      const htmlOutput = IdentityPrinter.print(rewrittenNode)

      parts.push(`**HTML equivalent**\n\`\`\`erb\n${dedent(htmlOutput.trim())}\n\`\`\``)
    } else {
      const shallowResult = this.rewriteElement(textDocument, bestElement.node, { includeBody: false })

      parts.push(`**HTML equivalent**\n\`\`\`erb\n${dedent(shallowResult.trim())}\n\`\`\``)
    }

    if (helper) {
      const gemLabel = helper.gem === "actionview" ? "Action View" : helper.gem

      if (helper.documentationURL) {
        parts.push(`[${elementSource}](${helper.documentationURL}) · ${gemLabel}`)
      } else {
        parts.push(`${elementSource} · ${gemLabel}`)
      }
    }

    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: parts.join("\n\n"),
      },
      range: bestElement.range,
    }
  }

  private getERBHelperHover(root: Node, position: Position): Hover | null {
    const collector = new ERBHelperCollector()
    collector.visit(root)

    let bestMatch: ERBHelperMatch | null = null
    let bestSize = Infinity

    for (const match of collector.matches) {
      if (isPositionInRange(position, match.range)) {
        const size = rangeSize(match.range)

        if (size < bestSize) {
          bestSize = size
          bestMatch = match
        }
      }
    }

    if (!bestMatch) return null

    const { helper } = bestMatch
    const parts: string[] = []

    parts.push(`\`\`\`ruby\n${helper.signature}\n\`\`\``)

    if (helper.description) {
      parts.push(helper.description)
    }

    const gemLabel = helper.gem === "actionview" ? "Action View" : helper.gem

    if (helper.documentationURL) {
      parts.push(`[${helper.source}](${helper.documentationURL}) · ${gemLabel}`)
    } else {
      parts.push(`${helper.source} · ${gemLabel}`)
    }

    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: parts.join("\n\n"),
      },
      range: bestMatch.range,
    }
  }

  private rewriteElement(textDocument: TextDocument, node: HTMLElementNode, options: { includeBody: boolean }): string {
    const parseResult = this.parserService.parseContent(textDocument.getText(), {
      action_view_helpers: true,
      track_whitespace: true,
    })

    const rewriter = new ActionViewTagHelperToHTMLRewriter()
    const collector = new ActionViewElementCollector()

    collector.visit(parseResult.value)

    const match = collector.elements.find(element =>
      element.node.location.start.line === node.location.start.line &&
      element.node.location.start.column === node.location.start.column
    )

    if (!match) return ""

    const rewrittenNode = rewriter.rewrite(cloneNode(match.node), {
      baseDir: this.baseDir,
      shallow: true,
      includeBody: options.includeBody,
    })

    if (!options.includeBody) {
      const openTag = rewrittenNode.open_tag ? IdentityPrinter.print(rewrittenNode.open_tag) : ""
      const closeTag = rewrittenNode.close_tag ? IdentityPrinter.print(rewrittenNode.close_tag) : ""
      return `${openTag}\n  ...\n${closeTag}`
    }

    return IdentityPrinter.print(rewrittenNode)
  }

  private rangesEqual(a: Range, b: Range): boolean {
    return a.start.line === b.start.line
        && a.start.character === b.start.character
        && a.end.line === b.end.line
        && a.end.character === b.end.character
  }

  private getEntityHover(textDocument: TextDocument, position: Position): Hover | null {
    const lineText = textDocument.getText(Range.create(position.line, 0, position.line + 1, 0))
    const match = findCharacterReferenceAtPosition(lineText, position.character)

    if (!match) return null

    const range = Range.create(
      position.line, match.start,
      position.line, match.end,
    )

    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: formatCharacterReferenceHover(match),
      },
      range,
    }
  }
}

interface CharacterReferenceMatch {
  reference: string
  start: number
  end: number
  characters: string
  codepoints: number[]
  type: "named" | "decimal" | "hexadecimal"
  name?: string
}

function findCharacterReferenceAtPosition(lineText: string, character: number): CharacterReferenceMatch | null {
  const pattern = new RegExp(CHARACTER_REFERENCE_PATTERN.source, "g")
  let match: RegExpExecArray | null

  while ((match = pattern.exec(lineText)) !== null) {
    const start = match.index
    const end = start + match[0].length

    if (character < start || character >= end) continue

    const reference = match[0]

    if (match[1]) {
      const codepoint = parseInt(match[1], 16)
      return {
        reference,
        start,
        end,
        characters: String.fromCodePoint(codepoint),
        codepoints: [codepoint],
        type: "hexadecimal",
      }
    }

    if (match[2]) {
      const codepoint = parseInt(match[2], 10)
      return {
        reference,
        start,
        end,
        characters: String.fromCodePoint(codepoint),
        codepoints: [codepoint],
        type: "decimal",
      }
    }

    if (match[3]) {
      const entity = getNamedCharacterReference(match[3])

      if (entity) {
        return {
          reference,
          start,
          end,
          characters: entity.characters,
          codepoints: entity.codepoints,
          type: "named",
          name: match[3],
        }
      }
    }
  }

  return null
}

function formatCodepoints(codepoints: number[]): string {
  return codepoints.map(codepoint => `U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}`).join(", ")
}

function formatCharacterReferenceHover(match: CharacterReferenceMatch): string {
  const parts: string[] = []

  parts.push(`## \`${match.characters}\``)

  const typeLabel = match.type === "named" ? "Named character reference"
    : match.type === "decimal" ? "Decimal numeric character reference"
    : "Hexadecimal numeric character reference"

  parts.push(`**${typeLabel}**`)

  const details: string[] = []
  details.push(`| Character | \`${match.characters}\` |`)
  details.push(`| Codepoint${match.codepoints.length > 1 ? "s" : ""} | ${formatCodepoints(match.codepoints)} |`)
  details.push(`| Reference | \`${match.reference}\` |`)

  if (match.name) {
    details.push(`| Name | \`${match.name}\` |`)
  }

  parts.push(`| | |\n|---|---|\n${details.join("\n")}`)

  parts.push(`[HTML spec: Character references](https://html.spec.whatwg.org/multipage/syntax.html#character-references)`)

  return parts.join("\n\n")
}
