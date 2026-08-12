import { TextEdit } from "vscode-languageserver-types"

import type { Position } from "vscode-languageserver-types"
import type { TextDocument } from "vscode-languageserver-textdocument"
import type { ParserService } from "./parser_service"

export class OnTypeFormattingProvider {
  private readonly parserService: ParserService

  constructor(parserService: ParserService) {
    this.parserService = parserService
  }

  getTextEdits(
    document: TextDocument,
    position: Position,
    character: string,
  ): TextEdit[] {
    if (character !== ">") return []

    const offset = document.offsetAt(position)
    const source = document.getText()
    const lineStart = source.lastIndexOf("\n", offset - 1) + 1
    const line = source.slice(lineStart, offset)

    const tagStart = line.lastIndexOf("<%")
    if (tagStart === -1) return []

    const tag = line.slice(tagStart)
    if (!tag.endsWith("%>")) return []

    const sourceWithoutTag =
      source.slice(0, lineStart + tagStart) + source.slice(offset)
    if (this.missingEnds(source) <= this.missingEnds(sourceWithoutTag))
      return []

    const indentation = line.match(/^\s*/)?.[0] ?? ""

    return [TextEdit.insert(position, `\n${indentation}<% end %>`)]
  }

  private missingEnds(source: string): number {
    return this.parserService
      .parseContent(source)
      .recursiveErrors()
      .filter((error) => error.type === "MISSING_ERB_END_TAG_ERROR").length
  }
}
