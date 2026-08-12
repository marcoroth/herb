import type { DocumentNode } from "@herb-tools/core"
import type { HTMLDocument } from "vscode-html-languageservice"

import { HerbHTMLNode } from "./herb-html-node.js"
import { adaptDocumentChildren } from "./ast-adapter.js"
import { buildLineOffsetTable } from "./offset-utils.js"

/**
 * Builds a vscode-html-languageservice-compatible HTMLDocument from
 * a Herb DocumentNode AST.
 *
 * The returned document has the same interface as what
 * vscode-html-languageservice's parseHTMLDocument returns,
 * so it can be passed directly to doComplete, doHover, etc.
 */
export function buildHTMLDocument(herbDocument: DocumentNode, source: string, tokenListAttributes?: Set<string>): HTMLDocument {
  const lineOffsets = buildLineOffsetTable(source)
  const roots = adaptDocumentChildren(herbDocument, lineOffsets, source, tokenListAttributes)

  const rootNode = new HerbHTMLNode({
    start: 0,
    end: source.length,
    closed: true,
    herbNode: herbDocument,
  })

  rootNode.children = roots

  for (const root of roots) {
    root.parent = rootNode
  }

  return {
    roots: roots as unknown as HTMLDocument["roots"],
    findNodeBefore: rootNode.findNodeBefore.bind(rootNode) as HTMLDocument["findNodeBefore"],
    findNodeAt: rootNode.findNodeAt.bind(rootNode) as HTMLDocument["findNodeAt"],
  }
}
