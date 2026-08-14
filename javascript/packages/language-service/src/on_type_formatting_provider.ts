import { TextEdit } from "vscode-languageserver-types"

import type { FormattingOptions, Position } from "vscode-languageserver-types"
import type { TextDocument } from "vscode-languageserver-textdocument"
import type { ParserService } from "./parser_service"

interface OnTypeFormattingResult {
  edits: TextEdit[]
  cursor: Position | null
}

export class OnTypeFormattingProvider {
  private readonly parserService: ParserService

  constructor(parserService: ParserService) {
    this.parserService = parserService
  }

  getTextEdits(
    document: TextDocument,
    position: Position,
    character: string,
    options: FormattingOptions = { tabSize: 2, insertSpaces: true },
  ): TextEdit[] {
    return this.getFormatting(document, position, character, options).edits
  }

  getFormatting(
    document: TextDocument,
    position: Position,
    character: string,
    options: FormattingOptions = { tabSize: 2, insertSpaces: true },
  ): OnTypeFormattingResult {
    if (character !== ">") return { edits: [], cursor: null }

    const offset = document.offsetAt(position)
    const source = document.getText()
    const lineStart = source.lastIndexOf("\n", offset - 1) + 1
    const line = source.slice(lineStart, offset)

    const tagStart = line.lastIndexOf("<%")
    if (tagStart === -1) return { edits: [], cursor: null }

    const tag = line.slice(tagStart)
    if (!tag.endsWith("%>")) return { edits: [], cursor: null }

    const sourceWithoutTag =
      source.slice(0, lineStart + tagStart) + source.slice(offset)
    if (this.missingEnds(source) <= this.missingEnds(sourceWithoutTag))
      return { edits: [], cursor: null }

    const indentation = line.match(/^\s*/)?.[0] ?? ""
    const indentationUnit = options.insertSpaces
      ? " ".repeat(options.tabSize)
      : "\t"
    const bodyIndentation = indentation + indentationUnit

    return {
      edits: [
        TextEdit.insert(
          position,
          `\n${bodyIndentation}\n${indentation}<% end %>`,
        ),
      ],
      cursor: {
        line: position.line + 1,
        character: bodyIndentation.length,
      },
    }
  }

  private missingEnds(source: string): number {
    return this.parserService
      .parseContent(source)
      .recursiveErrors()
      .filter((error) => error.type === "MISSING_ERB_END_TAG_ERROR").length
  }
}
