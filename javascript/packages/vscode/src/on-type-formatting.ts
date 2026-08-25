import {
  CancellationToken,
  Position,
  SnippetString,
  TextDocument,
  window,
} from "vscode"

const BLOCK_SNIPPET = new SnippetString("\n\t$0\n<% end %>")

export async function applyOnTypeFormattingSnippet(
  document: TextDocument,
  documentVersion: number,
  position: Position,
  character: string,
  token: CancellationToken,
): Promise<boolean> {
  if (
    token.isCancellationRequested ||
    document.version !== documentVersion ||
    character !== ">"
  ) {
    return false
  }

  const source = document.getText()
  const offset = document.offsetAt(position)
  if (!shouldCompleteErbBlock(source, offset)) return false

  const editor = window.visibleTextEditors.find(
    (candidate) =>
      candidate.document.uri.toString() === document.uri.toString(),
  )
  if (!editor) return false

  return editor.insertSnippet(BLOCK_SNIPPET, position, {
    undoStopBefore: false,
    undoStopAfter: false,
  })
}

function shouldCompleteErbBlock(source: string, offset: number): boolean {
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1
  const line = source.slice(lineStart, offset)
  const tagStart = line.lastIndexOf("<%")

  if (tagStart === -1 || !isBlockOpener(line.slice(tagStart))) return false

  const absoluteTagStart = lineStart + tagStart
  const enclosingBlocks = blockDepthBefore(source, absoluteTagStart)

  return !hasMatchingEnd(source.slice(offset), enclosingBlocks)
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
