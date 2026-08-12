import { TextEdit } from "vscode-languageserver-types"

import type { Position } from "vscode-languageserver-types"
import type { TextDocument } from "vscode-languageserver-textdocument"

export class OnTypeFormattingProvider {
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
    if (!this.isBlockOpener(tag)) return []
    if (this.hasMatchingEnd(source.slice(offset))) return []

    const indentation = line.match(/^\s*/)?.[0] ?? ""

    return [TextEdit.insert(position, `\n${indentation}<% end %>`)]
  }

  private hasMatchingEnd(source: string): boolean {
    const tags = source.matchAll(/<%(?![=#])\s*([\s\S]*?)\s*%>/g)
    let nestedBlocks = 0

    for (const match of tags) {
      const tag = match[0]
      const code = match[1]

      if (this.isBlockOpener(tag)) {
        nestedBlocks += 1
      } else if (/^end\b/.test(code)) {
        if (nestedBlocks === 0) return true

        nestedBlocks -= 1
      }
    }

    return false
  }

  private isBlockOpener(tag: string): boolean {
    const match = tag.match(/^<%(?![=#])\s*([\s\S]*?)\s*%>$/)
    if (!match) return false

    const code = match[1]

    return (
      /^(?:if|unless|while|for)\b/.test(code) ||
      /\bdo(?:\s*\|[^|]*\|)?\s*$/.test(code)
    )
  }
}
