import { classifyTokens, splitRubyContent, viewHelperExists } from "@herb-tools/core"

import { StrictLocalsCollector } from "./strict_locals_collector"

import { ParserService } from "./parser_service"

import type { TextDocument } from "vscode-languageserver-textdocument"
import type { SemanticTokens, SemanticTokensLegend } from "vscode-languageserver-types"
import type { Token, TokenCategory, ClassifiedToken } from "@herb-tools/core"

export const semanticTokenTypes = [
  "type",
  "property",
  "string",
  "macro",
  "comment",
  "keyword",
  "function",
  "parameter",
] as const

export const semanticTokenModifiers = ["defaultLibrary", "output"] as const
export type SemanticTokenType = typeof semanticTokenTypes[number]

export const semanticTokensLegend: SemanticTokensLegend = {
  tokenTypes: [...semanticTokenTypes],
  tokenModifiers: [...semanticTokenModifiers],
}

const DEFAULT_LIBRARY = 1 << semanticTokenModifiers.indexOf("defaultLibrary")
const OUTPUT = 1 << semanticTokenModifiers.indexOf("output")

const TYPE_BY_CATEGORY: Partial<Record<TokenCategory, SemanticTokenType>> = {
  "html.tagName": "type",
  "html.attributeName": "property",
  "html.attributeValue": "string",
  "html.delimiter": "macro",
  "html.comment": "comment",
  "html.doctype": "keyword",
  "html.entity": "string",
  "erb.delimiter": "macro",
  "erb.commentDelimiter": "comment",
  "erb.comment": "comment",
}

interface SemanticToken {
  line: number
  startCharacter: number
  length: number
  tokenType: number
  tokenModifiers: number
}

export class SemanticTokensProvider {
  private parserService: ParserService

  constructor(parserService: ParserService) {
    this.parserService = parserService
  }

  get legend(): SemanticTokensLegend {
    return semanticTokensLegend
  }

  getSemanticTokens(textDocument: TextDocument): SemanticTokens {
    const source = textDocument.getText()
    const result = this.parserService.lexDocument(textDocument)

    if (!result) return { data: [] }

    const tokens: SemanticToken[] = []

    for (const classified of classifyTokens(result, source)) {
      tokens.push(...semanticTokensFor(classified, source))
    }

    const locals = this.strictLocalTokens(textDocument)
    const ordered = [...carveOut(tokens, locals), ...locals]
      .sort((a, b) => a.line - b.line || a.startCharacter - b.startCharacter)

    return { data: encode(ordered) }
  }

  private strictLocalTokens(textDocument: TextDocument): SemanticToken[] {
    const collector = new StrictLocalsCollector()

    try {
      const parsed = this.parserService.parseContent(textDocument.getText(), { strict_locals: true })

      collector.visit(parsed.value as never)
    } catch {
      return []
    }

    return collector.declarations.flatMap(({ name, location }) => {
      if (location.start.line !== location.end.line) return []

      return [{
        line: location.start.line - 1,
        startCharacter: location.start.column,
        length: name.length,
        tokenType: semanticTokenTypes.indexOf("parameter"),
        tokenModifiers: 0,
      }]
    })
  }
}

function semanticTokensFor({ token, category, output }: ClassifiedToken, source: string): SemanticToken[] {
  if (category === "erb.content") return rubyContentTokens(token, source)

  const type = TYPE_BY_CATEGORY[category]
  if (!type) return []

  const modifiers = category === "erb.delimiter" && output ? OUTPUT : 0
  const singleLine = singleLineToken(token, semanticTokenTypes.indexOf(type), modifiers)

  return singleLine ? [singleLine] : []
}

function rubyContentTokens(token: Token, source: string): SemanticToken[] {
  const tokens: SemanticToken[] = []
  const helper = actionViewHelperToken(token, source)

  if (helper) tokens.push(helper)

  const content = source.slice(token.range.start, token.range.end)

  for (const fragment of splitRubyContent(content)) {
    if (!fragment.keyword) continue

    const { line, character } = positionAt(source, token.range.start + fragment.offset)

    tokens.push({
      line,
      startCharacter: character,
      length: fragment.length,
      tokenType: semanticTokenTypes.indexOf("keyword"),
      tokenModifiers: 0,
    })
  }

  return tokens.sort((a, b) => a.line - b.line || a.startCharacter - b.startCharacter)
}

function positionAt(source: string, offset: number): { line: number, character: number } {
  const preceding = source.slice(0, offset)
  const lastNewline = preceding.lastIndexOf("\n")

  return {
    line: preceding.split("\n").length - 1,
    character: lastNewline === -1 ? offset : offset - lastNewline - 1,
  }
}

function actionViewHelperToken(token: Token, source: string): SemanticToken | null {
  const content = source.slice(token.range.start, token.range.end)
  const match = content.match(/^(\s*)([a-z_][a-zA-Z0-9_]*[?!]?)/)

  if (!match) return null

  const [, leading, name] = match

  if (!viewHelperExists(name)) return null

  const start = token.location.start

  if (leading.includes("\n")) return null

  return {
    line: start.line - 1,
    startCharacter: start.column + leading.length,
    length: name.length,
    tokenType: semanticTokenTypes.indexOf("function"),
    tokenModifiers: DEFAULT_LIBRARY,
  }
}

function singleLineToken(token: Token, tokenType: number, tokenModifiers: number): SemanticToken | null {
  const start = token.location.start
  const length = token.range.end - token.range.start

  if (length <= 0) return null
  if (token.location.end.line !== start.line) return null

  return { line: start.line - 1, startCharacter: start.column, length, tokenType, tokenModifiers }
}

function carveOut(tokens: SemanticToken[], holes: SemanticToken[]): SemanticToken[] {
  if (holes.length === 0) return tokens

  return tokens.flatMap(token => {
    const inside = holes
      .filter(hole => hole.line === token.line)
      .filter(hole => hole.startCharacter >= token.startCharacter)
      .filter(hole => hole.startCharacter + hole.length <= token.startCharacter + token.length)
      .sort((a, b) => a.startCharacter - b.startCharacter)

    if (inside.length === 0) return [token]

    const pieces: SemanticToken[] = []

    let cursor = token.startCharacter

    for (const hole of inside) {
      if (hole.startCharacter > cursor) {
        pieces.push({ ...token, startCharacter: cursor, length: hole.startCharacter - cursor })
      }

      cursor = hole.startCharacter + hole.length
    }

    const end = token.startCharacter + token.length

    if (end > cursor) pieces.push({ ...token, startCharacter: cursor, length: end - cursor })

    return pieces
  })
}

function encode(tokens: SemanticToken[]): number[] {
  const data: number[] = []

  let previousLine = 0
  let previousCharacter = 0

  for (const token of tokens) {
    const deltaLine = token.line - previousLine
    const deltaCharacter = deltaLine === 0 ? token.startCharacter - previousCharacter : token.startCharacter

    data.push(deltaLine, deltaCharacter, token.length, token.tokenType, token.tokenModifiers)

    previousLine = token.line
    previousCharacter = token.startCharacter
  }

  return data
}
