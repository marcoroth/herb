import { HerbHTMLNode } from "./herb-html-node.js"
import { CompletionItemKind, InsertTextFormat } from "vscode-html-languageservice"

import { buildHTMLDocument } from "./herb-html-document.js"
import { getLanguageService as getUpstreamLanguageService } from "vscode-html-languageservice"

import { TOKEN_LIST_ATTRIBUTES } from "@herb-tools/core"

import type { ParseOptions } from "@herb-tools/core"
import type { LanguageServiceOptions } from "./types.js"
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
  const upstream = getUpstreamLanguageService(options)
  const herb = options?.herb
  const dataProviders = options?.customDataProviders ?? []

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
