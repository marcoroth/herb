import { TextDocument } from "vscode-languageserver-textdocument"
import { ParserService } from "./parser_service"
import { Visitor, RubyReferenceCollector } from "@herb-tools/core"
import { Command, CompletionItem, CompletionItemKind, CompletionList, InsertTextFormat, MarkupKind, Position, Range, TextEdit } from "vscode-languageserver-types"

import { getBlockArgumentCompletions } from "./language-service"
import { nodeToRange, isPositionInRange, rangeSize, lspPosition } from "./range_utils"
import { collectHerbAttributes, collectStateDirectives } from "./herb_attribute_links"
import { HERB_ATTRIBUTES } from "@herb-tools/client/directives"

import type { DocumentNode } from "@herb-tools/core"
import { partialNameForFile, strictLocalsDeclaration, templateNameForFile } from "@herb-tools/analysis"
import { isERBContentNode, isERBOutputNode, isHTMLOpenTagNode, isHTMLTextNode, isValidLocalName, getHelperEntries } from "@herb-tools/core"

import type { ProjectConfig } from "./types.js"
import type { Node, ERBContentNode, HTMLOpenTagNode, HTMLTextNode, HelperEntry, HelperOption, RubyReference } from "@herb-tools/core"
import type { PartialIndex, PartialDeclaration } from "@herb-tools/analysis"

import { HELPER_REGISTRY, HTML_NAMED_CHARACTER_REFERENCES, HTML_ELEMENTS } from "@herb-tools/core"

const HTML_OPEN_TAG_PATTERN = /<(\w*)$/
const AUTHORED_HERB_ATTRIBUTES = [
  HERB_ATTRIBUTES.name,
  HERB_ATTRIBUTES.into,
  HERB_ATTRIBUTES.set,
  HERB_ATTRIBUTES.toggle,
  HERB_ATTRIBUTES.increment,
  HERB_ATTRIBUTES.decrement,
  HERB_ATTRIBUTES.reset,
  HERB_ATTRIBUTES.by,
]

const HERB_VALUE_ATTRIBUTES = new Set<string>([
  HERB_ATTRIBUTES.into,
  HERB_ATTRIBUTES.set,
  HERB_ATTRIBUTES.toggle,
  HERB_ATTRIBUTES.increment,
  HERB_ATTRIBUTES.decrement,
  HERB_ATTRIBUTES.reset,
])

const COMMON_ACTION_EVENTS = ["click", "change", "input", "submit", "focus", "blur", "focusin", "focusout", "mouseenter", "mouseleave", "keydown", "keyup"]

const ACTION_EVENTS = [
  ...COMMON_ACTION_EVENTS,
  "animationend", "animationiteration", "animationstart",
  "beforeinput", "cancel", "close", "contextmenu", "copy", "cut",
  "dblclick", "drag", "dragend", "dragenter", "dragleave", "dragover", "dragstart", "drop",
  "ended", "invalid", "mousedown", "mousemove", "mouseout", "mouseover", "mouseup",
  "paste", "pause", "play", "pointercancel", "pointerdown", "pointerenter", "pointerleave", "pointermove", "pointerup",
  "reset", "scroll", "scrollend", "select", "toggle",
  "touchcancel", "touchend", "touchmove", "touchstart",
  "transitioncancel", "transitionend", "transitionrun", "transitionstart",
  "wheel",
]

function currentToken(valueText: string, separators: string[]): string {
  let token = valueText

  for (const separator of separators) {
    const index = token.lastIndexOf(separator)

    if (index !== -1) token = token.slice(index + 1)
  }

  return token
}

const CHARACTER_REFERENCE_PATTERN = /&([a-zA-Z]*)$/

const TAG_DOT_PATTERN = /tag\.(\w*)$/
const CONTENT_TAG_SYMBOL_PATTERN = /content_tag\s+:(\w*)$/
const ERB_EXPRESSION_PATTERN = /^(\w*)$/
const RENDER_KEYWORD_PATTERN = /\brender\b[\s\S]*?:?\b(partial|layout|spacer_template)\s*(?::|=>)\s*(["'])([^"']*)$/
const RENDER_POSITIONAL_PATTERN = /\brender\b\s*\(?\s*(["'])([^"']*)$/
const RENDER_CALL_PATTERN = /\brender\b(?:\s*\(|\s)([\s\S]*)$/
const RENDER_PARTIAL_ARGUMENT = /\bpartial\s*(?::|=>)\s*["']([^"']+)["']/
const RENDER_POSITIONAL_ARGUMENT = /^\s*\(?\s*["']([^"']+)["']/
const LOCALS_HASH = /\blocals\s*(?::|=>)\s*$/
const KEY_POSITION = /(?:^|,)\s*(\w*)$/
const VALUE_POSITION = /(?:^|,)\s*(\w+)\s*(?::(?!:)|=>)\s*(@?\w*)$/
const EXPRESSION_TYPES = new Set(["array", "object"])
const WRITTEN_KEY = /\b(\w+)\s*(?::(?!:)|=>)/g
const SPACER_KEYWORD = "spacer_template"
const LOCALS_KEYWORD = "locals"
const RENDER_HELPER = "render"
const RENDER_SORT = "!!"

const OPTION_SNIPPETS: Record<string, string> = {
  string: `"$0"`,
  array: `\${1:[]}`,
  object: `\${1:nil}`,
  symbol: `:$0`,
}

const SUGGESTS_AFTER_INSERT = new Set(["partial", "layout", SPACER_KEYWORD, LOCALS_KEYWORD])
const TRIGGER_SUGGEST: Command = { title: "Suggest", command: "editor.action.triggerSuggest" }

const APPLICATION_DIRECTORY = "application"

const SAME_DIRECTORY_RANK = 0
const APPLICATION_RANK = 1
const DISTANCE_RANK_OFFSET = 1

const COMMON_TAGS = new Set([
  "div", "span", "p", "a", "button", "form", "input", "label",
  "ul", "ol", "li", "h1", "h2", "h3", "section", "header",
  "footer", "nav", "main", "article", "aside", "table", "img",
])

interface RenderCall {
  keyword: string | undefined
  quote: string
  after: string
  closed: boolean
}

interface RenderArgument {
  prefix: string
  locals: boolean
  written: Set<string>
  partial: string | null
  valueFor: string | null
}

function publicHelpers(): HelperEntry[] {
  const helpers = new Map<string, HelperEntry>()

  for (const helper of getHelperEntries()) {
    if (helper.visibility !== "public") continue
    if (helper.receiver !== "view") continue
    if (helpers.has(helper.name)) continue

    helpers.set(helper.name, helper)
  }

  return [...helpers.values()].sort((a, b) => a.name.localeCompare(b.name))
}

const HELPERS = publicHelpers()

function preselectBest(items: CompletionItem[]): CompletionItem[] {
  let best: CompletionItem | null = null

  for (const item of items) {
    if (!best || item.sortText! < best.sortText!) best = item
  }

  if (best) {
    best.preselect = true
  }

  return items
}

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

export class CompletionProvider {
  private parserService: ParserService
  private partials?: PartialIndex
  private relativePathFor: (uri: string) => string | null
  private config?: ProjectConfig

  constructor(
    parserService: ParserService,
    partials?: PartialIndex,
    relativePathFor: (uri: string) => string | null = () => null
  ) {
    this.parserService = parserService
    this.partials = partials
    this.relativePathFor = relativePathFor
  }

  setConfig(config?: ProjectConfig) {
    this.config = config
  }

  getCompletions(document: TextDocument, position: Position): CompletionList | null {
    const parseResult = this.parserService.parseContent(document.getText(), {
      track_whitespace: true,
    })

    const herb = this.getHerbAttributeCompletions(document, position, parseResult.value as DocumentNode)

    if (herb) return herb

    const collector = new NodeAtPositionCollector(position)
    collector.visit(parseResult.value)

    const node = this.findDeepestNode(collector.matches)

    const textAfterCursor = document.getText({
      start: position,
      end: Position.create(position.line + 1, 0),
    })

    if (node && isERBContentNode(node)) {
      return this.getERBCompletions(node, position, textAfterCursor, document)
    }

    if (node && isHTMLOpenTagNode(node)) {
      return this.getHTMLOpenTagCompletions(node, position, document)
    }

    if (node && isHTMLTextNode(node)) {
      return this.getHTMLTextCompletions(document, position)
    }

    return this.getDocumentLevelCompletions(document, position)
  }

  private getHerbAttributeCompletions(document: TextDocument, position: Position, root: DocumentNode): CompletionList | null {
    const lineText = document.getText({
      start: Position.create(position.line, 0),
      end: position,
    })

    const valueMatch = lineText.match(/([\w-]+)="([^"]*)$/)

    if (valueMatch && HERB_VALUE_ATTRIBUTES.has(valueMatch[1])) {
      return this.getHerbValueCompletions(valueMatch[1], valueMatch[2], position, root)
    }

    const rubyValueMatch = lineText.match(/\bherb_([a-z]+):\s*["']([^"']*)$/)

    if (rubyValueMatch) {
      const attribute = (HERB_ATTRIBUTES as Record<string, string>)[rubyValueMatch[1]]

      if (attribute && HERB_VALUE_ATTRIBUTES.has(attribute)) {
        return this.getHerbValueCompletions(attribute, rubyValueMatch[2], position, root)
      }
    }

    const rubyKeyMatch = lineText.match(/\bdata:\s*\{[^{}]*?([a-z_]*)$/)

    if (rubyKeyMatch) {
      return this.getHerbHashKeyCompletions(rubyKeyMatch[1], position)
    }

    const nameMatch = lineText.match(/<[a-zA-Z][^<>]*\s(data-[\w-]*)$/)

    if (nameMatch) {
      return this.getHerbNameCompletions(nameMatch[1], position)
    }

    return null
  }

  private getHerbHashKeyCompletions(prefix: string, position: Position): CompletionList | null {
    const keys = AUTHORED_HERB_ATTRIBUTES.map(attribute => attribute.replace("data-", "").replace(/-/g, "_"))
    const matching = keys.filter(key => key.startsWith(prefix))

    if (matching.length === 0) return null

    const replaced = Range.create(Position.create(position.line, position.character - prefix.length), position)

    const items = matching.map(key => ({
      label: `${key}:`,
      kind: CompletionItemKind.Property,
      insertTextFormat: InsertTextFormat.Snippet,
      textEdit: TextEdit.replace(replaced, `${key}: "$1"`),
      detail: "Herb",
      command: HERB_VALUE_ATTRIBUTES.has(`data-${key.replace(/_/g, "-")}`) ? TRIGGER_SUGGEST : undefined,
    }))

    return { isIncomplete: false, items }
  }

  private getHerbNameCompletions(prefix: string, position: Position): CompletionList | null {
    const matching = AUTHORED_HERB_ATTRIBUTES.filter(attribute => attribute.startsWith(prefix))

    if (matching.length === 0) return null

    const replaced = Range.create(Position.create(position.line, position.character - prefix.length), position)

    const items = matching.map(attribute => ({
      label: attribute,
      kind: CompletionItemKind.Property,
      textEdit: TextEdit.replace(replaced, `${attribute}="$1"`),
      insertTextFormat: InsertTextFormat.Snippet,
      detail: "Herb",
      command: HERB_VALUE_ATTRIBUTES.has(attribute) ? TRIGGER_SUGGEST : undefined,
    }))

    return { isIncomplete: false, items }
  }

  private getHerbValueCompletions(attribute: string, valueText: string, position: Position, root: DocumentNode): CompletionList | null {
    if (attribute === HERB_ATTRIBUTES.into) {
      const names = collectHerbAttributes(root).slotNames.filter(group => group.declarations.length > 0)

      return this.herbItems(names.map(group => group.name), valueText, position, CompletionItemKind.Reference, "collection")
    }

    const states = collectStateDirectives(root)
      .filter(entry => entry.scope === null || isPositionInRange(position, nodeToRange(entry.scope)))
      .flatMap(entry => entry.signature.declarations)
    const kinds = new Map(states.map(declaration => [declaration.name, declaration.kind]))

    if (attribute === HERB_ATTRIBUTES.toggle || attribute === HERB_ATTRIBUTES.increment || attribute === HERB_ATTRIBUTES.decrement || attribute === HERB_ATTRIBUTES.reset) {
      const wanted = attribute === HERB_ATTRIBUTES.toggle ? "boolean" : attribute === HERB_ATTRIBUTES.reset ? null : "integer"
      const token = currentToken(valueText, [",", " ", ">"])
      const names = [...kinds.entries()].filter(([, kind]) => wanted === null || kind === wanted || kind === "bare").map(([name]) => name)

      return this.herbItems(names, token, position, CompletionItemKind.Variable, "state", name => kinds.get(name) ?? "")
    }

    if (attribute === HERB_ATTRIBUTES.set) {
      const clause = valueText.split(" ").pop() ?? ""
      const piece = clause.slice(clause.lastIndexOf(">") + 1).split(",").pop() ?? ""
      const separator = piece.indexOf("=")

      if (separator !== -1) {
        const name = piece.slice(0, separator).trim()
        const kind = kinds.get(name)

        if (kind === "boolean") {
          return this.herbItems(["true", "false"], piece.slice(separator + 1), position, CompletionItemKind.Value, "value")
        }

        if (kind === "string") {
          return this.herbItems(["''"], piece.slice(separator + 1), position, CompletionItemKind.Value, "empty string")
        }

        return null
      }

      const items = this.herbItems([...kinds.keys()], piece, position, CompletionItemKind.Variable, "state", name => kinds.get(name) ?? "", "=", TRIGGER_SUGGEST)
        ?? { isIncomplete: false, items: [] as CompletionItem[] }

      if (!clause.includes("->")) {
        const replaced = Range.create(Position.create(position.line, position.character - piece.length), position)

        for (const event of ACTION_EVENTS.filter(event => event.startsWith(piece))) {
          items.items.push({
            label: `${event}->`,
            kind: CompletionItemKind.Event,
            insertTextFormat: InsertTextFormat.Snippet,
            textEdit: TextEdit.replace(replaced, `${event}->$0`),
            detail: "event",
            command: TRIGGER_SUGGEST,
            sortText: COMMON_ACTION_EVENTS.includes(event) ? `1_${String(COMMON_ACTION_EVENTS.indexOf(event)).padStart(2, "0")}` : `2_${event}`,
          })
        }
      }

      return items.items.length > 0 ? items : null
    }

    return null
  }

  private herbItems(names: string[], prefix: string, position: Position, kind: CompletionItemKind, detail: string, kindOf?: (name: string) => string, suffix = "", command?: Command): CompletionList | null {
    const matching = names.filter(name => name.startsWith(prefix.trim()))

    if (matching.length === 0) return null

    const replaced = Range.create(Position.create(position.line, position.character - prefix.length), position)

    const items = matching.map((name, index) => ({
      label: name,
      kind,
      insertTextFormat: InsertTextFormat.Snippet,
      textEdit: TextEdit.replace(replaced, `${name}${suffix}$0`),
      detail: kindOf ? `${detail} (${kindOf(name)})` : detail,
      sortText: `0_${String(index).padStart(2, "0")}`,
      preselect: index === 0,
      command,
    }))

    return { isIncomplete: false, items }
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

  private getERBCompletions(node: ERBContentNode, position: Position, textAfterCursor: string, document: TextDocument): CompletionList | null {
    if (this.config?.framework !== "actionview") return null
    if (!node.content) return null

    const contentText = node.content.value
    const contentStart = lspPosition(node.content.location.start)
    const cursorOffset = document.offsetAt(position) - document.offsetAt(contentStart)

    if (cursorOffset < 0 || cursorOffset > contentText.length) return null

    const textBeforeCursor = contentText.substring(0, cursorOffset).trimStart()

    const keywordMatch = textBeforeCursor.match(RENDER_KEYWORD_PATTERN)
    const positionalMatch = keywordMatch ? null : textBeforeCursor.match(RENDER_POSITIONAL_PATTERN)

    if (keywordMatch || positionalMatch) {
      const [keyword, quote, prefix] = keywordMatch
        ? [keywordMatch[1], keywordMatch[2], keywordMatch[3]]
        : [undefined, positionalMatch![1], positionalMatch![2]]

      const call = { keyword, quote, after: contentText.substring(cursorOffset), closed: !!node.tag_closing }

      return this.getPartialNameCompletions(prefix, call, position, document)
    }

    const argument = this.renderArgumentAt(textBeforeCursor)

    if (argument) {
      if (argument.valueFor) return this.getVariableCompletions(argument, contentStart, position, document)

      return argument.locals
        ? this.getStrictLocalCompletions(argument, position, document)
        : this.getRenderKeywordCompletions(argument, position, document)
    }

    const blockArguments = getBlockArgumentCompletions(document, position, this.config)
    if (blockArguments) return blockArguments

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
      const prefix = erbMatch[1]

      if (prefix === "" && !isERBOutputNode(node)) return null

      return this.getHelperCompletions(prefix, !!node.tag_closing)
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
    const items: CompletionItem[] = HTML_ELEMENTS
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
          detail: `tag.${tag.name} - ${tag.description}`,
          sortText: `!0${isCommon ? "0" : "1"}${String(index).padStart(3, "0")}`,
          insertTextFormat: hasClosingERBTag ? InsertTextFormat.PlainText : InsertTextFormat.Snippet,
          insertText,
        }
      })

    return CompletionList.create(preselectBest(items), false)
  }

  private getContentTagCompletions(prefix: string, hasSpaceAfterCursor: boolean): CompletionList {
    const items: CompletionItem[] = HTML_ELEMENTS
      .filter(tag => tag.name.startsWith(prefix))
      .map((tag, index) => {
        const isCommon = COMMON_TAGS.has(tag.name)

        return {
          label: `:${tag.name}`,
          kind: CompletionItemKind.Property,
          detail: `content_tag :${tag.name} - ${tag.description}`,
          sortText: `!0${isCommon ? "0" : "1"}${String(index).padStart(3, "0")}`,
          insertTextFormat: InsertTextFormat.PlainText,
          filterText: tag.name,
          insertText: hasSpaceAfterCursor ? tag.name : `${tag.name} `,
        }
      })

    return CompletionList.create(preselectBest(items), false)
  }

  private getHTMLTagCompletions(prefix: string): CompletionList {
    const items: CompletionItem[] = HTML_ELEMENTS
      .filter(tag => tag.name.startsWith(prefix))
      .map((tag, index) => {
        const isCommon = COMMON_TAGS.has(tag.name)
        const insertText = tag.isVoid
          ? `${tag.name} $0/>`
          : `${tag.name}>$0</${tag.name}>`

        return {
          label: tag.name,
          kind: CompletionItemKind.Property,
          detail: `<${tag.name}> - ${tag.description}`,
          sortText: `!0${isCommon ? "0" : "1"}${String(index).padStart(3, "0")}`,
          insertTextFormat: InsertTextFormat.Snippet,
          insertText,
        }
      })

    return CompletionList.create(preselectBest(items), false)
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

  private getPartialNameCompletions(prefix: string, call: RenderCall, position: Position, document: TextDocument): CompletionList | null {
    const partials = this.partials

    if (!partials) return null

    const file = this.relativePathFor(document.uri)
    const directory = file === null ? null : this.directoryOf(file, partials.viewRoots[0] ?? ".")
    const lowercasePrefix = prefix.toLowerCase()

    const nameRange = Range.create(document.positionAt(document.offsetAt(position) - prefix.length), position)
    const scope = call.closed ? call.after : call.after.split("\n")[0]
    const closes = scope.startsWith(call.quote)
    const remainder = closes ? scope.slice(call.quote.length) : scope
    const argumentsFollow = remainder.trim() !== ""
    const padding = remainder === "" ? " " : ""
    const callRange = Range.create(nameRange.start, closes ? document.positionAt(document.offsetAt(position) + call.quote.length) : position)

    const spellsOutPartial = !call.keyword && !argumentsFollow
    const opening = spellsOutPartial ? `partial: ${call.quote}` : ""
    const start = spellsOutPartial ? document.positionAt(document.offsetAt(nameRange.start) - call.quote.length) : nameRange.start

    const items: CompletionItem[] = partials.entries()
      .map(([name, declaration]) => ({ name, declaration, ...this.placementOf(name, directory) }))
      .filter(partial => partial.names.some(name => name.toLowerCase().startsWith(lowercasePrefix)))
      .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
      .map((partial, index) => {
        const locals = argumentsFollow || call.keyword === SPACER_KEYWORD ? "" : this.requiredLocalsSnippet(partial.declaration)
        const completesCall = !argumentsFollow && (locals !== "" || !call.closed)

        const item = {
          label: partial.name,
          kind: CompletionItemKind.File,
          detail: partial.declaration.file,
          documentation: this.partialDocumentation(partial.declaration),
          sortText: `${RENDER_SORT}${String(index).padStart(4, "0")}`,
          filterText: partial.name,
        }

        if (!completesCall) {
          return {
            ...item,
            insertTextFormat: InsertTextFormat.PlainText,
            textEdit: TextEdit.replace(Range.create(start, position), `${opening}${partial.name}`),
          }
        }

        const tail = call.closed ? `${padding}$0` : ` $0%>`

        return {
          ...item,
          insertTextFormat: InsertTextFormat.Snippet,
          textEdit: TextEdit.replace(Range.create(start, callRange.end), `${opening}${partial.name}${call.quote}${locals}${tail}`),
          command: locals ? TRIGGER_SUGGEST : undefined,
        }
      })

    if (items.length === 0) return null

    return CompletionList.create(preselectBest(items), false)
  }

  private renderArgumentAt(textBeforeCursor: string): RenderArgument | null {
    const match = textBeforeCursor.match(RENDER_CALL_PATTERN)

    if (!match) return null

    const args = match[1]
    const scan = this.scanArguments(args)

    if (scan.quoted) return null

    const shorthand = args.match(RENDER_POSITIONAL_ARGUMENT)?.[1] ?? null
    const partial = args.match(RENDER_PARTIAL_ARGUMENT)?.[1] ?? shorthand

    if (scan.openBrace === -1) {
      const key = args.match(KEY_POSITION)
      const locals = shorthand !== null

      if (key) return { prefix: key[1], locals, written: this.writtenKeys(args), partial, valueFor: null }

      const value = args.match(VALUE_POSITION)

      if (!value) return null
      if (!locals && !this.takesExpression(value[1])) return null

      return { prefix: value[2], locals, written: this.writtenKeys(args), partial, valueFor: value[1] }
    }

    if (!LOCALS_HASH.test(args.slice(0, scan.openBrace))) return null

    const inside = args.slice(scan.openBrace + 1)
    const key = inside.match(KEY_POSITION)

    if (key) return { prefix: key[1], locals: true, written: this.writtenKeys(inside), partial, valueFor: null }

    const value = inside.match(VALUE_POSITION)

    if (!value) return null

    return { prefix: value[2], locals: true, written: this.writtenKeys(inside), partial, valueFor: value[1] }
  }

  private takesExpression(option: string): boolean {
    const type = HELPER_REGISTRY[RENDER_HELPER]?.options?.find(candidate => candidate.name === option)?.type

    return typeof type === "string" && EXPRESSION_TYPES.has(type)
  }

  private scanArguments(text: string): { quoted: boolean, openBrace: number } {
    const open: number[] = []

    let quote: string | null = null

    for (let index = 0; index < text.length; index++) {
      const character = text[index]

      if (quote) {
        if (character === "\\") index++
        else if (character === quote) quote = null

        continue
      }

      if (character === `"` || character === `'`) quote = character
      else if (character === "{") open.push(index)
      else if (character === "}") open.pop()
    }

    return { quoted: quote !== null, openBrace: open.at(-1) ?? -1 }
  }

  private writtenKeys(text: string): Set<string> {
    return new Set([...text.matchAll(WRITTEN_KEY)].map(match => match[1]))
  }

  private getRenderKeywordCompletions(argument: RenderArgument, position: Position, document: TextDocument): CompletionList | null {
    const options = HELPER_REGISTRY[RENDER_HELPER]?.options ?? []
    const range = this.prefixRange(argument.prefix, position, document)
    const separator = this.separatorBefore(range.start, document)

    const items: CompletionItem[] = options
      .filter(option => !argument.written.has(option.name))
      .filter(option => option.name.startsWith(argument.prefix))
      .map((option, index) => ({
        label: option.name,
        kind: CompletionItemKind.Property,
        detail: Array.isArray(option.type) ? option.type.join(" | ") : String(option.type),
        documentation: { kind: MarkupKind.Markdown, value: option.description },
        sortText: `${RENDER_SORT}${String(index).padStart(3, "0")}`,
        insertTextFormat: InsertTextFormat.Snippet,
        textEdit: TextEdit.replace(range, `${separator}${this.optionSnippet(option)}`),
        command: SUGGESTS_AFTER_INSERT.has(option.name) ? TRIGGER_SUGGEST : undefined,
      }))

    if (items.length === 0) return null

    return CompletionList.create(preselectBest(items), false)
  }

  private getStrictLocalCompletions(argument: RenderArgument, position: Position, document: TextDocument): CompletionList | null {
    const partials = this.partials

    if (!partials || !argument.partial) return null

    const file = this.relativePathFor(document.uri)
    const declaration = partials.lookup(argument.partial, file ?? undefined)

    if (!declaration?.hasDeclaration) return null

    const range = this.prefixRange(argument.prefix, position, document)
    const separator = this.separatorBefore(range.start, document)

    const items: CompletionItem[] = declaration.locals
      .filter(local => !argument.written.has(local.name))
      .filter(local => local.name.startsWith(argument.prefix))
      .sort((a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name))
      .map((local, index) => ({
        label: local.name,
        kind: CompletionItemKind.Variable,
        detail: local.required ? "required" : "optional",
        sortText: `${RENDER_SORT}${String(index).padStart(3, "0")}`,
        insertTextFormat: InsertTextFormat.Snippet,
        textEdit: TextEdit.replace(range, `${separator}${local.name}: \${1:${local.name}}$0`),
        command: TRIGGER_SUGGEST,
      }))

    if (items.length === 0) return null

    return CompletionList.create(preselectBest(items), false)
  }

  private optionSnippet(option: HelperOption): string {
    if (option.name === LOCALS_KEYWORD) return `${LOCALS_KEYWORD}: { $0 }`

    const value = typeof option.type === "string" ? OPTION_SNIPPETS[option.type] : undefined

    return `${option.name}: ${value ?? "$0"}`
  }

  private getVariableCompletions(argument: RenderArgument, contentStart: Position, position: Position, document: TextDocument): CompletionList | null {
    const names = this.variablesIn(document, contentStart)

    if (names.length === 0) return null

    const range = this.prefixRange(argument.prefix, position, document)
    const separator = this.separatorBefore(range.start, document)
    const wanted = argument.valueFor

    const items: CompletionItem[] = names
      .filter(name => name.startsWith(argument.prefix) || name.replace(/^@/, "").startsWith(argument.prefix))
      .sort((a, b) => Number(this.namesLocal(b, wanted)) - Number(this.namesLocal(a, wanted)) || a.localeCompare(b))
      .map((name, index) => ({
        label: name,
        kind: name.startsWith("@") ? CompletionItemKind.Field : CompletionItemKind.Variable,
        detail: name.startsWith("@") ? "instance variable" : "local variable",
        sortText: `${RENDER_SORT}${String(index).padStart(3, "0")}`,
        insertTextFormat: InsertTextFormat.PlainText,
        textEdit: TextEdit.replace(range, `${separator}${name}`),
      }))

    if (items.length === 0) return null

    return CompletionList.create(preselectBest(items), false)
  }

  private namesLocal(name: string, wanted: string | null): boolean {
    return wanted !== null && name.replace(/^@/, "") === wanted
  }

  private variablesIn(document: TextDocument, contentStart: Position): string[] {
    const text = document.getText()
    const result = this.parserService.parseContent(text, { prism_program: true })

    if (!result.value.prismNode) return []

    const collector = new RubyReferenceCollector()

    collector.visit(result.value.prismNode)

    const limit = new TextEncoder().encode(text.slice(0, document.offsetAt(contentStart))).length
    const written = (reference: RubyReference) => reference.startOffset < limit
    const names = new Set<string>()

    for (const reference of [...collector.instanceVariableReads, ...collector.instanceVariableWrites]) {
      if (written(reference) && isValidLocalName(reference.name.slice(1))) names.add(reference.name)
    }

    for (const reference of [...collector.localBindings, ...collector.localReads]) {
      if (written(reference) && isValidLocalName(reference.name)) names.add(reference.name)
    }

    return [...names]
  }

  private prefixRange(prefix: string, position: Position, document: TextDocument): Range {
    return Range.create(document.positionAt(document.offsetAt(position) - prefix.length), position)
  }

  private separatorBefore(start: Position, document: TextDocument): string {
    const offset = document.offsetAt(start)

    if (offset === 0) return ""

    return /\s/.test(document.getText(Range.create(document.positionAt(offset - 1), start))) ? "" : " "
  }

  private requiredLocalsSnippet(declaration: PartialDeclaration): string {
    const required = declaration.locals.filter(local => local.required)

    if (required.length === 0) return ""

    const assignments = required
      .map((local, index) => `${local.name}: \${${index + 1}:${local.name}}`)
      .join(", ")

    return `, locals: { ${assignments} }`
  }

  private placementOf(name: string, directory: string | null): { names: string[], rank: number } {
    const separator = name.lastIndexOf("/")
    const partialDirectory = separator === -1 ? "" : name.slice(0, separator)
    const base = separator === -1 ? name : name.slice(separator + 1)

    if (directory !== null && partialDirectory === directory) {
      return { names: [name, base], rank: SAME_DIRECTORY_RANK }
    }

    if (partialDirectory === APPLICATION_DIRECTORY) {
      return { names: [name, base], rank: APPLICATION_RANK }
    }

    return { names: [name], rank: DISTANCE_RANK_OFFSET + this.distanceBetween(directory, partialDirectory) }
  }

  private distanceBetween(from: string | null, to: string): number {
    if (from === null) return 0

    const fromSegments = from === "" ? [] : from.split("/")
    const toSegments = to === "" ? [] : to.split("/")

    let shared = 0

    while (shared < fromSegments.length && shared < toSegments.length && fromSegments[shared] === toSegments[shared]) {
      shared++
    }

    return (fromSegments.length - shared) + (toSegments.length - shared)
  }

  private directoryOf(file: string, viewRoot: string): string | null {
    const name = partialNameForFile(file, viewRoot) ?? templateNameForFile(file, viewRoot)

    if (name === null) return null

    const separator = name.lastIndexOf("/")

    return separator === -1 ? "" : name.slice(0, separator)
  }

  private partialDocumentation(declaration: PartialDeclaration) {
    if (!declaration.hasDeclaration) return undefined

    const signature = strictLocalsDeclaration({
      locals: declaration.locals,
      callSiteCount: 0,
      keywordRest: declaration.hasKeywordRest,
    })

    return {
      kind: MarkupKind.Markdown,
      value: ["```erb", signature, "```"].join("\n"),
    }
  }

  private getHelperCompletions(prefix: string, closed: boolean): CompletionList | null {
    const items: CompletionItem[] = HELPERS
      .filter(helper => helper.name.startsWith(prefix))
      .map((helper, index) => {
        const documentation = [
          helper.description,
          helper.documentationURL ? `[Documentation](${helper.documentationURL})` : null,
        ].filter(Boolean).join("\n\n")

        const rendersPartial = helper.name === RENDER_HELPER

        return {
          label: helper.name,
          kind: CompletionItemKind.Function,
          detail: helper.signature,
          documentation: {
            kind: MarkupKind.Markdown,
            value: documentation,
          },
          sortText: `!00${String(index).padStart(3, "0")}`,
          insertTextFormat: rendersPartial ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
          insertText: rendersPartial ? `${RENDER_HELPER} partial: "$0"${closed ? "" : " %>"}` : helper.name,
          command: rendersPartial ? TRIGGER_SUGGEST : undefined,
        }
      })

    if (items.length === 0) {
      return null
    }

    return CompletionList.create(preselectBest(items), false)
  }
}
