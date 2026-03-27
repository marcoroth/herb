import {
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  InsertTextFormat,
  MarkupKind,
  Position,
} from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Visitor, isERBContentNode, isHTMLOpenTagNode, isHTMLTextNode, HTML_NAMED_CHARACTER_REFERENCES } from "@herb-tools/core"
import { ParserService } from "./parser_service"
import { nodeToRange, isPositionInRange, rangeSize } from "./range_utils"
import { HTML_TAGS } from "./html_tags"
import { ACTION_VIEW_HELPERS } from "./action_view_helpers"

import type { Node, ERBContentNode, HTMLOpenTagNode, HTMLTextNode } from "@herb-tools/core"
import type { Range } from "vscode-languageserver/node"

const HTML_OPEN_TAG_PATTERN = /<(\w*)$/
const CHARACTER_REFERENCE_PATTERN = /&([a-zA-Z]*)$/

const TAG_DOT_PATTERN = /tag\.(\w*)$/
const CONTENT_TAG_SYMBOL_PATTERN = /content_tag\s+:(\w*)$/
const ERB_EXPRESSION_PATTERN = /^(\w*)$/

const COMMON_TAGS = new Set([
  "div", "span", "p", "a", "button", "form", "input", "label",
  "ul", "ol", "li", "h1", "h2", "h3", "section", "header",
  "footer", "nav", "main", "article", "aside", "table", "img",
])

interface HelperCompletionInfo {
  name: string
  signature: string
  documentationURL: string
}

function extractHelpers(): HelperCompletionInfo[] {
  return Object.entries(ACTION_VIEW_HELPERS).map(([key, info]) => {
    const name = key.split("#").pop()!
    return { name, ...info }
  })
}

const HELPERS = extractHelpers()

class NodeAtPositionCollector extends Visitor {
  public matches: { node: Node; range: Range }[] = []
  private position: Position

  constructor(position: Position) {
    super()
    this.position = position
  }

  visitERBContentNode(node: ERBContentNode): void {
    const range = nodeToRange(node)

    if (isPositionInRange(this.position, range)) {
      this.matches.push({ node, range })
    }

    this.visitChildNodes(node)
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    const range = nodeToRange(node)

    if (isPositionInRange(this.position, range)) {
      this.matches.push({ node, range })
    }

    this.visitChildNodes(node)
  }

  visitHTMLTextNode(node: HTMLTextNode): void {
    const range = nodeToRange(node)

    if (isPositionInRange(this.position, range)) {
      this.matches.push({ node, range })
    }
  }
}

export class CompletionService {
  private parserService: ParserService

  constructor(parserService: ParserService) {
    this.parserService = parserService
  }

  getCompletions(document: TextDocument, position: Position): CompletionList | null {
    const parseResult = this.parserService.parseContent(document.getText(), {
      track_whitespace: true,
    })

    const collector = new NodeAtPositionCollector(position)
    collector.visit(parseResult.value)

    const node = this.findDeepestNode(collector.matches)

    const textAfterCursor = document.getText({
      start: position,
      end: Position.create(position.line + 1, 0),
    })

    if (node && isERBContentNode(node)) {
      return this.getERBCompletions(node, position, textAfterCursor)
    }

    if (node && isHTMLOpenTagNode(node)) {
      return this.getHTMLOpenTagCompletions(node, position, document)
    }

    if (node && isHTMLTextNode(node)) {
      return this.getHTMLTextCompletions(document, position)
    }

    return this.getDocumentLevelCompletions(document, position)
  }

  private getDocumentLevelCompletions(document: TextDocument, position: Position): CompletionList | null {
    const lineText = document.getText({
      start: Position.create(position.line, 0),
      end: position,
    })

    const entityMatch = lineText.match(CHARACTER_REFERENCE_PATTERN)

    if (entityMatch) {
      return this.getCharacterReferenceCompletions(entityMatch[1])
    }

    return null
  }

  private findDeepestNode(matches: { node: Node; range: Range }[]): Node | null {
    let best: Node | null = null
    let bestSize = Infinity

    for (const match of matches) {
      const size = rangeSize(match.range)

      if (size < bestSize) {
        bestSize = size
        best = match.node
      }
    }

    return best
  }

  private getERBCompletions(node: ERBContentNode, position: Position, textAfterCursor: string): CompletionList | null {
    if (!node.content) return null

    const contentText = node.content.value
    const contentStart = node.content.location.start
    const cursorOffset = position.character - contentStart.column

    const textBeforeCursor = contentText.substring(0, cursorOffset).trimStart()

    const tagDotMatch = textBeforeCursor.match(TAG_DOT_PATTERN)

    if (tagDotMatch) {
      const hasClosingERBTag = /^\s*%>/.test(textAfterCursor)
      return this.getTagDotCompletions(tagDotMatch[1], hasClosingERBTag)
    }

    const contentTagMatch = textBeforeCursor.match(CONTENT_TAG_SYMBOL_PATTERN)

    if (contentTagMatch) {
      const hasSpaceAfterCursor = /^\s/.test(textAfterCursor)
      return this.getContentTagCompletions(contentTagMatch[1], hasSpaceAfterCursor)
    }

    const erbMatch = textBeforeCursor.match(ERB_EXPRESSION_PATTERN)

    if (erbMatch) {
      return this.getHelperCompletions(erbMatch[1])
    }

    return null
  }

  private getHTMLOpenTagCompletions(node: HTMLOpenTagNode, position: Position, document: TextDocument): CompletionList | null {
    if (!node.tag_opening) return null

    const lineText = document.getText({
      start: Position.create(position.line, 0),
      end: position,
    })

    const entityMatch = lineText.match(CHARACTER_REFERENCE_PATTERN)

    if (entityMatch) {
      return this.getCharacterReferenceCompletions(entityMatch[1])
    }

    const tagOpenEnd = node.tag_opening.location.end
    const tagNameStart = node.tag_name?.location.start
    const tagNameEnd = node.tag_name?.location.end

    const isAfterOpenBracket = position.line === tagOpenEnd.line - 1 && position.character >= tagOpenEnd.column
    const isInTagName = tagNameStart && tagNameEnd &&
      position.line >= tagNameStart.line - 1 && position.line <= tagNameEnd.line - 1 &&
      position.character >= tagNameStart.column && position.character <= tagNameEnd.column

    if (!isAfterOpenBracket && !isInTagName) return null

    const prefix = node.tag_name ? node.tag_name.value.substring(0, position.character - node.tag_name.location.start.column) : ""

    return this.getHTMLTagCompletions(prefix)
  }

  private getHTMLTextCompletions(document: TextDocument, position: Position): CompletionList | null {
    const lineText = document.getText({
      start: Position.create(position.line, 0),
      end: position,
    })

    const tagMatch = lineText.match(HTML_OPEN_TAG_PATTERN)

    if (tagMatch) {
      return this.getHTMLTagCompletions(tagMatch[1])
    }

    const entityMatch = lineText.match(CHARACTER_REFERENCE_PATTERN)

    if (entityMatch) {
      return this.getCharacterReferenceCompletions(entityMatch[1])
    }

    return null
  }

  private getTagDotCompletions(prefix: string, hasClosingERBTag: boolean): CompletionList {
    const items: CompletionItem[] = HTML_TAGS
      .filter(tag => tag.name.startsWith(prefix))
      .map((tag, index) => {
        const isCommon = COMMON_TAGS.has(tag.name)

        let insertText: string

        if (hasClosingERBTag) {
          insertText = tag.name
        } else if (tag.isVoid) {
          insertText = `${tag.name} $0 %>`
        } else {
          insertText = `${tag.name} do %>$0<% end %>`
        }

        return {
          label: tag.name,
          kind: CompletionItemKind.Property,
          detail: `tag.${tag.name} — ${tag.description}`,
          sortText: `!0${isCommon ? "0" : "1"}${String(index).padStart(3, "0")}`,
          insertTextFormat: hasClosingERBTag ? InsertTextFormat.PlainText : InsertTextFormat.Snippet,
          insertText,
          preselect: isCommon,
        }
      })

    return CompletionList.create(items, false)
  }

  private getContentTagCompletions(prefix: string, hasSpaceAfterCursor: boolean): CompletionList {
    const items: CompletionItem[] = HTML_TAGS
      .filter(tag => tag.name.startsWith(prefix))
      .map((tag, index) => {
        const isCommon = COMMON_TAGS.has(tag.name)

        return {
          label: `:${tag.name}`,
          kind: CompletionItemKind.Property,
          detail: `content_tag :${tag.name} — ${tag.description}`,
          sortText: `!0${isCommon ? "0" : "1"}${String(index).padStart(3, "0")}`,
          insertTextFormat: InsertTextFormat.PlainText,
          filterText: tag.name,
          insertText: hasSpaceAfterCursor ? tag.name : `${tag.name} `,
          preselect: isCommon,
        }
      })

    return CompletionList.create(items, false)
  }

  private getHTMLTagCompletions(prefix: string): CompletionList {
    const items: CompletionItem[] = HTML_TAGS
      .filter(tag => tag.name.startsWith(prefix))
      .map((tag, index) => {
        const isCommon = COMMON_TAGS.has(tag.name)
        const insertText = tag.isVoid
          ? `${tag.name} $0/>`
          : `${tag.name}>$0</${tag.name}>`

        return {
          label: tag.name,
          kind: CompletionItemKind.Property,
          detail: `<${tag.name}> — ${tag.description}`,
          sortText: `!0${isCommon ? "0" : "1"}${String(index).padStart(3, "0")}`,
          insertTextFormat: InsertTextFormat.Snippet,
          insertText,
          preselect: isCommon,
        }
      })

    return CompletionList.create(items, false)
  }

  private getCharacterReferenceCompletions(prefix: string): CompletionList {
    const entries = Object.entries(HTML_NAMED_CHARACTER_REFERENCES)
    const lowercasePrefix = prefix.toLowerCase()

    const items: CompletionItem[] = entries
      .filter(([name]) => name.toLowerCase().startsWith(lowercasePrefix))
      .sort((a, b) => {
        const aExact = a[0].startsWith(prefix)
        const bExact = b[0].startsWith(prefix)

        if (aExact !== bExact) return aExact ? -1 : 1

        return a[0].localeCompare(b[0])
      })
      .slice(0, 100)
      .map(([name, reference], index) => {
        const codepoints = reference.codepoints
          .map(codepoint => `U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}`)
          .join(", ")

        return {
          label: `&${name};`,
          kind: CompletionItemKind.Value,
          detail: `\`${reference.characters}\` (${codepoints})`,
          documentation: {
            kind: MarkupKind.Markdown,
            value: [
              `| | |`,
              `|---|---|`,
              `| **Character** | \`${reference.characters}\` |`,
              `| **Codepoints** | ${codepoints} |`,
              `| **Reference** | \`&${name};\` |`,
            ].join("\n"),
          },
          sortText: `!0${String(index).padStart(4, "0")}`,
          filterText: `&${name}`,
          insertText: `${name};`,
          insertTextFormat: InsertTextFormat.PlainText,
        }
      })

    return CompletionList.create(items, true)
  }

  private getHelperCompletions(prefix: string): CompletionList | null {
    const items: CompletionItem[] = HELPERS
      .filter(helper => helper.name.startsWith(prefix))
      .map((helper, index) => {
        return {
          label: helper.name,
          kind: CompletionItemKind.Function,
          detail: helper.signature,
          documentation: {
            kind: MarkupKind.Markdown,
            value: `[Documentation](${helper.documentationURL})`,
          },
          sortText: `!00${String(index).padStart(3, "0")}`,
          insertTextFormat: InsertTextFormat.PlainText,
          insertText: helper.name,
          preselect: true,
        }
      })

    if (items.length === 0) {
      return null
    }

    return CompletionList.create(items, false)
  }
}
