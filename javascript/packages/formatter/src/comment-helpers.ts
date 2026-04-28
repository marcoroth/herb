import dedent from "dedent"

import { isNode, isERBNode } from "@herb-tools/core"
import { IdentityPrinter } from "@herb-tools/printer"
import { Node, HTMLTextNode, LiteralNode } from "@herb-tools/core"

/**
 * Result of formatting an ERB comment.
 * - `single-line`: the caller emits the text on a single line (using push or pushWithIndent)
 * - `multi-line`: the caller emits header, indented content lines, and footer separately
 */
export type ERBCommentResult =
  | { type: 'single-line'; text: string }
  | { type: 'multi-line'; header: string; contentLines: string[]; footer: string }

/**
 * Extract the raw inner text from HTML comment children.
 * Joins text/literal nodes by content and ERB nodes via IdentityPrinter.
 */
export function extractHTMLCommentContent(children: Node[]): string {
  return children.map(child => {
    if (isNode(child, HTMLTextNode) || isNode(child, LiteralNode)) {
      return child.content
    } else if (isERBNode(child)) {
      return IdentityPrinter.print(child)
    } else {
      return ""
    }
  }).join("")
}

/**
 * Format the inner content of an HTML comment.
 *
 * Handles three cases:
 * 1. IE conditional comments (`[if ...` / `<![endif]`) — returned as-is
 * 2. Multiline comments — re-indented with relative indent preservation
 * 3. Single-line comments — wrapped with spaces: ` content `
 *
 * Returns null for IE conditional comments to signal the caller
 * should emit the raw content without reformatting.
 *
 * @param rawInner - The joined children content string (may be empty)
 * @param indentWidth - Number of spaces per indent level
 * @returns The formatted inner string, or null if rawInner is empty-ish
 */
export function formatHTMLCommentInner(rawInner: string, indentWidth: number): string {
  if (!rawInner && rawInner !== "") return ""

  const trimmedInner = rawInner.trim()

  if (trimmedInner.startsWith('[if ') && trimmedInner.endsWith('<![endif]')) {
    return rawInner
  }

  const hasNewlines = rawInner.includes('\n')

  if (hasNewlines) {
    const lines = rawInner.split('\n')
    const childIndent = " ".repeat(indentWidth)
    const firstLineHasContent = lines[0].trim() !== ''

    if (firstLineHasContent && lines.length > 1) {
      const contentLines = lines.map(line => line.trim()).filter(line => line !== '')
      return '\n' + contentLines.map(line => childIndent + line).join('\n') + '\n'
    } else {
      const contentLines = lines.filter((line, index) => {
        return line.trim() !== '' && !(index === 0 || index === lines.length - 1)
      })

      const minIndent = contentLines.length > 0 ? Math.min(...contentLines.map(line => line.length - line.trimStart().length)) : 0

      const processedLines = lines.map((line, index) => {
        const trimmedLine = line.trim()

        if ((index === 0 || index === lines.length - 1) && trimmedLine === '') {
          return line
        }

        if (trimmedLine !== '') {
          const currentIndent = line.length - line.trimStart().length
          const relativeIndent = Math.max(0, currentIndent - minIndent)

          return childIndent + " ".repeat(relativeIndent) + trimmedLine
        }

        return line
      })

      return processedLines.join('\n')
    }
  } else {
    return ` ${rawInner.trim()} `
  }
}

/**
 * Format an ERB comment into either a single-line or multi-line result.
 *
 * @param open - The opening tag (e.g. "<%#")
 * @param content - The raw content string between open/close tags
 * @param close - The closing tag (e.g. "%>")
 * @returns A discriminated union describing how to render the comment
 */
export function formatERBCommentLines(open: string, content: string, close: string): ERBCommentResult {
  const contentLines = content.split("\n")
  const contentTrimmedLines = content.trim().split("\n")

  if (contentLines.length === 1 && contentTrimmedLines.length === 1) {
    const startsWithSpace = content[0] === " "
    const before = startsWithSpace ? "" : " "

    return { type: 'single-line', text: open + before + content.trimEnd() + ' ' + close }
  }

  if (contentTrimmedLines.length === 1) {
    return { type: 'single-line', text: open + ' ' + content.trim() + ' ' + close }
  }

  const firstLineEmpty = contentLines[0].trim() === ""
  const dedentedContent = dedent(firstLineEmpty ? content : content.trimStart())

  return {
    type: 'multi-line',
    header: open,
    contentLines: dedentedContent.split("\n"),
    footer: close
  }
}
