import { HerbHTMLNode } from "./herb-html-node.js"
import { CompletionItemKind, InsertTextFormat } from "vscode-html-languageservice"

import { buildHTMLDocument } from "./herb-html-document.js"
import { getLanguageService as getUpstreamLanguageService } from "vscode-html-languageservice"
import { herbHTMLDataProvider } from "./herb_html_data_provider"

import { TOKEN_LIST_ATTRIBUTES, getHelper } from "@herb-tools/core"

import type { ParseOptions } from "@herb-tools/core"
import type { LanguageServiceOptions, ProjectConfig } from "./types.js"
import type { Framework } from "@herb-tools/config"
import type { TextDocument } from "vscode-languageserver-textdocument"
import type { Position, Range, CompletionList, CompletionItem, Hover, TextEdit, DocumentHighlight, DocumentLink, SymbolInformation, DocumentSymbol, FoldingRange, SelectionRange, WorkspaceEdit, IHTMLDataProvider } from "vscode-html-languageservice"
import type { LanguageService, HTMLDocument, HTMLFormatConfiguration, CompletionConfiguration, HoverSettings, DocumentContext } from "vscode-html-languageservice"

const DEFAULT_HERB_PARSE_OPTIONS: ParseOptions = {
  analyze: true,
  action_view_helpers: true,
  track_whitespace: false,
  strict: false,
}

export function getLanguageService(options?: LanguageServiceOptions): LanguageService {
  const dataProviders = [herbHTMLDataProvider, ...(options?.customDataProviders ?? [])]
  const upstream = getUpstreamLanguageService({ ...options, customDataProviders: dataProviders })
  const herb = options?.herb

  const framework = options?.framework

  const tokenListAttributes = new Set([
    ...TOKEN_LIST_ATTRIBUTES,
    ...options?.tokenListAttributes ?? [],
  ])

  const herbParseOptions = {
    ...DEFAULT_HERB_PARSE_OPTIONS,
    ...options?.herbParseOptions,
  }

  return {
    parseHTMLDocument(document: TextDocument): HTMLDocument {
      if (!herb?.backend) {
        return upstream.parseHTMLDocument(document)
      }

      const source = document.getText()

      try {
        const result = herb.parse(source, herbParseOptions)
        return buildHTMLDocument(result.value, source, tokenListAttributes)
      } catch {
        return upstream.parseHTMLDocument(document)
      }
    },

    createScanner(input: string, initialOffset?: number) {
      return upstream.createScanner(input, initialOffset)
    },

    doComplete(
      document: TextDocument,
      position: Position,
      htmlDocument: HTMLDocument,
      options?: CompletionConfiguration,
    ): CompletionList {
      const blockArgumentResult = getBlockArgumentCompletions(document, position, { framework })
      if (blockArgumentResult) return blockArgumentResult

      const erbResult = tryERBAttributeCompletion(document, position, htmlDocument, dataProviders, tokenListAttributes)
      if (erbResult) return erbResult

      return upstream.doComplete(document, position, htmlDocument, options)
    },

    doComplete2(
      document: TextDocument,
      position: Position,
      htmlDocument: HTMLDocument,
      documentContext: DocumentContext,
      options?: CompletionConfiguration,
    ): Promise<CompletionList> {
      return upstream.doComplete2(document, position, htmlDocument, documentContext, options)
    },

    setCompletionParticipants(registeredCompletionParticipants) {
      upstream.setCompletionParticipants(registeredCompletionParticipants)
    },

    doHover(
      document: TextDocument,
      position: Position,
      htmlDocument: HTMLDocument,
      options?: HoverSettings,
    ): Hover | null {
      return upstream.doHover(document, position, htmlDocument, options)
    },

    format(document: TextDocument, range: Range | undefined, options: HTMLFormatConfiguration): TextEdit[] {
      return upstream.format(document, range, options)
    },

    findDocumentHighlights(document: TextDocument, position: Position, htmlDocument: HTMLDocument): DocumentHighlight[] {
      return upstream.findDocumentHighlights(document, position, htmlDocument)
    },

    findDocumentLinks(document: TextDocument, documentContext: DocumentContext): DocumentLink[] {
      return upstream.findDocumentLinks(document, documentContext)
    },

    findDocumentSymbols(document: TextDocument, htmlDocument: HTMLDocument): SymbolInformation[] {
      return upstream.findDocumentSymbols(document, htmlDocument)
    },

    findDocumentSymbols2(document: TextDocument, htmlDocument: HTMLDocument): DocumentSymbol[] {
      return upstream.findDocumentSymbols2(document, htmlDocument)
    },

    getFoldingRanges(document: TextDocument, context?: { rangeLimit?: number }): FoldingRange[] {
      return upstream.getFoldingRanges(document, context)
    },

    getSelectionRanges(document: TextDocument, positions: Position[]): SelectionRange[] {
      return upstream.getSelectionRanges(document, positions)
    },

    doQuoteComplete(document: TextDocument, position: Position, htmlDocument: HTMLDocument, options?: CompletionConfiguration): string | null {
      return upstream.doQuoteComplete(document, position, htmlDocument, options)
    },

    doTagComplete(document: TextDocument, position: Position, htmlDocument: HTMLDocument): string | null {
      return upstream.doTagComplete(document, position, htmlDocument)
    },

    doRename(document: TextDocument, position: Position, newName: string, htmlDocument: HTMLDocument,): WorkspaceEdit | null {
      return upstream.doRename(document, position, newName, htmlDocument)
    },

    findMatchingTagPosition(document: TextDocument, position: Position, htmlDocument: HTMLDocument): Position | null {
      return upstream.findMatchingTagPosition(document, position, htmlDocument)
    },

    findLinkedEditingRanges(document: TextDocument, position: Position, htmlDocument: HTMLDocument): Range[] | null {
      return upstream.findLinkedEditingRanges(document, position, htmlDocument)
    },

    findOnTypeRenameRanges(document: TextDocument, position: Position, htmlDocument: HTMLDocument): Range[] | null {
      return upstream.findOnTypeRenameRanges(document, position, htmlDocument)
    },

    setDataProviders(useDefaultDataProvider: boolean, customDataProviders) {
      upstream.setDataProviders(useDefaultDataProvider, customDataProviders)
      dataProviders.length = 0
      dataProviders.push(...customDataProviders)
    },
  }
}

function hasClosingPipe(source: string, offset: number): boolean {
  const newline = source.indexOf("\n", offset)
  const closing = source.indexOf("%>", offset)

  const ends = [newline, closing].filter(index => index !== -1)
  const end = ends.length > 0 ? Math.min(...ends) : source.length

  return source.slice(offset, end).includes("|")
}

function currentERBTag(source: string, offset: number): string | null {
  const opening = source.lastIndexOf("<%", offset)
  if (opening === -1) return null

  const closing = source.lastIndexOf("%>", offset - 2)
  if (closing > opening) return null

  return source.slice(opening, offset)
}

export function getBlockArgumentCompletions(document: TextDocument, position: Position, config?: ProjectConfig): CompletionList | null {
  const source = document.getText()
  const offset = document.offsetAt(position)
  const tag = currentERBTag(source, offset)

  if (!tag) return null

  const block = tag.match(/\bdo\s*(\|[^|]*)?$/)
  if (!block) return null

  const typed = block[1] !== undefined
  const closed = typed && hasClosingPipe(source, offset)
  const suggestions = helperSuggestions(tag, config?.framework) ?? iterationSuggestions(tag)

  if (!suggestions) return null

  const declared = typed ? block[1].slice(1).split(",").length - 1 : 0

  const items: CompletionItem[] = suggestions.flatMap((suggestion, index) => {
    const names = suggestion.names.slice(declared)

    if (names.length === 0) return []

    const label = names.join(", ")

    return [{
      label: typed ? label : `|${label}|`,
      kind: CompletionItemKind.Variable,
      detail: suggestion.detail,
      documentation: suggestion.documentation,
      insertText: typed ? (closed ? label : `${label}|`) : `|${label}|`,
      insertTextFormat: InsertTextFormat.PlainText,
      sortText: String(index),
    }]
  })

  if (items.length === 0) return null

  return { isIncomplete: false, items }
}

interface BlockArgumentSuggestion {
  names: string[]
  detail?: string
  documentation?: string
}

function helperSuggestions(tag: string, framework?: Framework): BlockArgumentSuggestion[] | null {
  if (framework !== "actionview") return null

  const call = tag.match(/^<%=?-?\s*([a-z_][A-Za-z0-9_]*)/)
  if (!call) return null

  const helper = getHelper(call[1])
  if (!helper?.supportsBlock) return null
  if (helper.blockArguments.length === 0) return null

  return helper.blockArguments.map((argument, index) => ({
    names: helper.blockArguments.slice(0, index + 1).map(blockArgument => blockArgument.name),
    detail: argument.type,
    documentation: helper.blockArguments.slice(0, index + 1).map(blockArgument => `\`${blockArgument.name}\`: ${blockArgument.description}`).join("\n\n"),
  }))
}

const ITERATION_METHODS = new Set([
  "each",
  "each_with_index",
  "filter_map",
  "find",
  "detect",
  "flat_map",
  "group_by",
  "map",
  "reject",
  "select",
  "sort_by",
])

const COUNTER_METHODS = new Set(["times", "upto", "downto", "step"])

function counterSuggestions(): BlockArgumentSuggestion[] {
  const detail = "Iteration counter"

  return [
    { names: ["i"], detail },
    { names: ["index"], detail },
  ]
}

function iterationSuggestions(tag: string): BlockArgumentSuggestion[] | null {
  const call = tag.match(/\.\s*([a-z_]+)(\([^)]*\))?\s*do\s*(\|[^|]*)?$/)
  if (!call) return null

  if (COUNTER_METHODS.has(call[1])) return counterSuggestions()
  if (!ITERATION_METHODS.has(call[1])) return null

  const chain = tag.slice(0, call.index)
  const element = elementNameFrom(chain)

  if (!element) return null

  const receiver = chain.replace(/^<%=?-?\s*/, "").trim()
  const detail = `Element of \`${receiver}\``

  if (call[1] === "each_with_index") {
    return [
      { names: [element, "index"], detail },
      { names: [element], detail },
    ]
  }

  return [{ names: [element], detail }]
}

function elementNameFrom(chain: string): string | null {
  const segments = chain.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []

  for (const segment of [...segments].reverse()) {
    const element = singularize(segment)

    if (element) return element
  }

  return modelName(chain)
}

function modelName(chain: string): string | null {
  const constant = chain.match(/^<%=?-?\s*((?:[A-Z][A-Za-z0-9_]*::)*[A-Z][A-Za-z0-9_]*)\s*\./)
  if (!constant) return null

  return constant[1]
    .split("::")
    .pop()!
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
}

const IRREGULAR_PLURALS: Record<string, string> = {
  children: "child",
  people: "person",
  men: "man",
  women: "woman",
  feet: "foot",
  teeth: "tooth",
  geese: "goose",
  mice: "mouse",
  indices: "index",
  vertices: "vertex",
  matrices: "matrix",
}

const UNCOUNTABLE = new Set([
  "address",
  "alias",
  "bus",
  "class",
  "data",
  "gas",
  "information",
  "lens",
  "news",
  "series",
  "species",
  "status",
])

function singularize(word: string): string | null {
  const lower = word.toLowerCase()

  if (IRREGULAR_PLURALS[lower]) return IRREGULAR_PLURALS[lower]
  if (UNCOUNTABLE.has(lower)) return null

  if (/[^aeiou]ies$/.test(word)) return `${word.slice(0, -3)}y`
  if (/(ch|sh|ss|x|z)es$/.test(word)) return word.slice(0, -2)
  if (/[^s]s$/.test(word)) return word.slice(0, -1)

  return null
}

function tryERBAttributeCompletion(document: TextDocument, position: Position, htmlDocument: HTMLDocument, dataProviders: IHTMLDataProvider[], tokenListAttributes: Set<string>): CompletionList | null {
  const offset = document.offsetAt(position)
  const node = htmlDocument.findNodeAt(offset) as HerbHTMLNode | undefined

  if (!node?.herbNode) return null

  const herbNode = node.herbNode as { element_source?: string }
  if (!herbNode.element_source || herbNode.element_source === "HTML") return null
  if (!node.tag || !node.attributeSourceRanges) return null

  let currentAttribute: string | null = null

  for (const [attributeName, range] of Object.entries(node.attributeSourceRanges)) {
    if (offset >= range.valueStart && offset <= range.valueEnd) {
      currentAttribute = attributeName

      break
    }
  }

  if (!currentAttribute) {
    return collectERBAttributeNameCompletions(document, offset, node, dataProviders)
  }

  const items: CompletionItem[] = []
  const range = node.attributeSourceRanges[currentAttribute]

  const valueText = document.getText({
    start: document.positionAt(range.valueStart),
    end: document.positionAt(range.valueEnd),
  })

  const hasOpenQuote = valueText.startsWith('"') || valueText.startsWith("'")
  const hasCloseQuote = valueText.endsWith('"') || valueText.endsWith("'")
  const contentStart = range.valueStart + (hasOpenQuote ? 1 : 0)
  const contentEnd = range.valueEnd - (hasCloseQuote ? 1 : 0)

  let wordStart: number
  let wordEnd: number

  if (tokenListAttributes.has(currentAttribute)) {
    const source = document.getText()
    wordStart = offset
    wordEnd = offset

    while (wordStart > contentStart && source[wordStart - 1] !== " ") {
      wordStart--
    }
    while (wordEnd < contentEnd && source[wordEnd] !== " ") {
      wordEnd++
    }
  } else {
    wordStart = contentStart
    wordEnd = contentEnd
  }

  const replaceRange = {
    start: document.positionAt(wordStart),
    end: document.positionAt(wordEnd),
  }

  for (const provider of dataProviders) {
    if (!provider.isApplicable(document.languageId)) continue

    for (const value of provider.provideValues(node.tag, currentAttribute)) {
      items.push({
        label: value.name,
        kind: CompletionItemKind.Value,
        textEdit: { range: replaceRange, newText: value.name },
        insertTextFormat: InsertTextFormat.PlainText,
      })
    }
  }

  return { isIncomplete: false, items }
}

function collectERBAttributeNameCompletions(document: TextDocument, offset: number, node: HerbHTMLNode, dataProviders: IHTMLDataProvider[]): CompletionList | null {
  if (!node.tag) return null

  const existingAttributes = new Set(Object.keys(node.attributes ?? {}))
  const items: CompletionItem[] = []
  const source = document.getText()
  const insideDataHash = isInsideDataHash(source, offset, node.start)

  for (const provider of dataProviders) {
    if (!provider.isApplicable(document.languageId)) continue

    for (const attr of provider.provideAttributes(node.tag)) {
      if (existingAttributes.has(attr.name)) continue

      let label: string
      let insertText: string

      if (insideDataHash && attr.name.startsWith("data-")) {
        label = attr.name.slice(5).replace(/-/g, "_")
        insertText = `${label}: `
      } else if (insideDataHash) {
        continue
      } else {
        label = attr.name.replace(/-/g, "_")
        insertText = `${label}: `
      }

      items.push({
        label,
        kind: CompletionItemKind.Property,
        insertText,
        insertTextFormat: InsertTextFormat.PlainText,
      })
    }
  }

  return items.length > 0 ? { isIncomplete: false, items } : null
}

function isInsideDataHash(source: string, offset: number, nodeStart: number): boolean {
  let braceDepth = 0

  for (let i = offset - 1; i >= nodeStart; i--) {
    const ch = source[i]

    if (ch === "}") {
      braceDepth++
    } else if (ch === "{") {
      if (braceDepth > 0) {
        braceDepth--
      } else {
        const before = source.slice(Math.max(nodeStart, i - 10), i).trimEnd()
        return before.endsWith("data:")
      }
    }
  }

  return false
}
