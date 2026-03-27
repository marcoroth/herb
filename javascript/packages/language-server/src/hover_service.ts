import { Hover, MarkupKind, Position, Range } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Visitor } from "@herb-tools/node-wasm"
import { IdentityPrinter } from "@herb-tools/printer"
import { ActionViewTagHelperToHTMLRewriter } from "@herb-tools/rewriter"
import { isERBOpenTagNode, isHTMLElementNode, isERBContentNode, getNamedCharacterReference, HELPER_BY_SOURCE, HELPER_REGISTRY, CHARACTER_REFERENCE_PATTERN } from "@herb-tools/core"
import { ParserService } from "./parser_service"
import { lspPosition, isPositionInRange, rangeSize } from "./range_utils"

import type { Node, HTMLElementNode, ERBOpenTagNode, ERBContentNode, HTMLCharacterReference, HelperEntry } from "@herb-tools/core"

class ActionViewElementCollector extends Visitor {
  public elements: { node: HTMLElementNode; openTag: ERBOpenTagNode; range: Range }[] = []

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (node.element_source && node.element_source !== "HTML" && isERBOpenTagNode(node.open_tag)) {
      const content = node.open_tag.content
      const tagName = node.open_tag.tag_name

      if (content && tagName) {
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

export class HoverService {
  private parserService: ParserService

  constructor(parserService: ParserService) {
    this.parserService = parserService
  }

  getHover(textDocument: TextDocument, position: Position): Hover | null {
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
      const rewrittenNode = rewriter.rewrite(bestElement.node, { baseDir: process.cwd(), shallow: true })
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

    const rewrittenNode = rewriter.rewrite(match.node, {
      baseDir: process.cwd(),
      shallow: true,
      includeBody: options.includeBody,
    })

    if (!options.includeBody) {
      const openTag = match.node.open_tag ? IdentityPrinter.print(match.node.open_tag) : ""
      const closeTag = match.node.close_tag ? IdentityPrinter.print(match.node.close_tag) : ""
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
