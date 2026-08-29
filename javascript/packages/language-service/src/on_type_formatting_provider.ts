import { StringValue, TextEdit } from "vscode-languageserver-types"

import type { FormattingOptions, Position, Range, SnippetTextEdit } from "vscode-languageserver-types"
import type { TextDocument } from "vscode-languageserver-textdocument"

const DEFAULT_FORMATTING_OPTIONS: FormattingOptions = { tabSize: 2, insertSpaces: true }

interface BlockCompletion {
  range: Range
  opener: string
  indentation: string
  bodyIndentation: string
}

export class OnTypeFormattingProvider {
  getTextEdits(document: TextDocument, position: Position, character: string, options: FormattingOptions = DEFAULT_FORMATTING_OPTIONS): TextEdit[] {
    const completion = this.blockCompletionFor(document, position, character, options)

    if (!completion) return []

    return [TextEdit.insert(position, `\n${completion.bodyIndentation}\n${completion.indentation}<% end %>`)]
  }

  getSnippetTextEdits(document: TextDocument, position: Position, character: string, options: FormattingOptions = DEFAULT_FORMATTING_OPTIONS): SnippetTextEdit[] {
    const completion = this.blockCompletionFor(document, position, character, options)

    if (!completion) return []

    const snippet = `${escapeSnippet(completion.opener)}\n${completion.bodyIndentation}$0\n${completion.indentation}<% end %>`

    return [{ range: completion.range, snippet: StringValue.createSnippet(snippet) }]
  }

  private blockCompletionFor(document: TextDocument, position: Position, character: string, options: FormattingOptions): BlockCompletion | null {
    if (character !== ">") return null

    const source = document.getText()
    const offset = document.offsetAt(position)

    if (!shouldCompleteErbBlock(source, offset)) return null

    const lineStart = source.lastIndexOf("\n", offset - 1) + 1
    const opener = source.slice(lineStart, offset)
    const indentation = opener.match(/^\s*/)?.[0] ?? ""
    const indentationUnit = options.insertSpaces ? " ".repeat(options.tabSize) : "\t"

    return {
      range: { start: { line: position.line, character: 0 }, end: position },
      opener,
      indentation,
      bodyIndentation: indentation + indentationUnit
    }
  }
}

export function shouldCompleteErbBlock(source: string, offset: number): boolean {
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1
  const line = source.slice(lineStart, offset)
  const tagStart = line.lastIndexOf("<%")

  if (tagStart === -1 || !isBlockOpener(line.slice(tagStart))) return false

  const absoluteTagStart = lineStart + tagStart
  const enclosingBlocks = blockDepthBefore(source, absoluteTagStart)

  return !hasMatchingEnd(source.slice(offset), enclosingBlocks)
}

function escapeSnippet(text: string): string {
  return text.replace(/[\\$}]/g, "\\$&")
}

function blockDepthBefore(source: string, offset: number): number {
  let depth = 0

  for (const match of source.slice(0, offset).matchAll(erbTags())) {
    const code = match[1].trim()

    if (isBlockOpener(match[0])) {
      depth += 1
    } else if (/^end\b/.test(code)) {
      depth = Math.max(0, depth - 1)
    }
  }

  return depth
}

function hasMatchingEnd(source: string, enclosingBlocks: number): boolean {
  let nestedBlocks = 0
  let availableEnds = 0

  for (const match of source.matchAll(erbTags())) {
    const code = match[1].trim()

    if (isBlockOpener(match[0])) {
      nestedBlocks += 1
    } else if (/^end\b/.test(code)) {
      if (nestedBlocks > 0) {
        nestedBlocks -= 1
      } else {
        availableEnds += 1
      }
    }
  }

  return availableEnds > enclosingBlocks
}

function isBlockOpener(tag: string): boolean {
  const match = tag.match(/^<%(?![=#])\s*([\s\S]*?)\s*%>$/)

  if (!match) return false

  const code = match[1].trim()

  return (
    /^(?:begin|case|class|def|for|if|module|unless|until|while)\b/.test(code) ||
    /\bdo(?:\s*\|[^|]*\|)?\s*$/.test(code)
  )
}

function erbTags(): RegExp {
  return /<%(?![=#])\s*([\s\S]*?)\s*%>/g
}
