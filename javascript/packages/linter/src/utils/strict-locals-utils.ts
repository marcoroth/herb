import { Visitor } from "@herb-tools/core"

import { isPrismNodeType, isRubyParameterNode } from "@herb-tools/core"

import type { DocumentNode, ERBStrictLocalsNode, PrismNodes, RubyParameterNode } from "@herb-tools/core"

export function extractRubyCommentContent(content: string): string | null {
  const match = content.match(/^\s*#\s*(.*)$/)

  return match ? match[1].trim() : null
}

export function looksLikeLocalsDeclaration(content: string): boolean {
  return /^locals?\b/.test(content) && /[(:)]/.test(content)
}

export const LOCAL_ASSIGNS = "local_assigns"

const KEYWORD_KIND = "keyword"
const KEYWORD_REST_KIND = "keyword_rest"

const VALUE_LOOKUPS = ["[]", "fetch", "dig"]
const PRESENCE_LOOKUPS = ["key?", "has_key?", "include?", "member?"]

export interface LocalAssignsLookup {
  name: string
  method: string
  presence: boolean
  extraArguments: boolean
  startOffset: number
  length: number
}

export class StrictLocalsDeclarationCollector extends Visitor {
  hasDeclaration = false
  hasKeywordRest = false

  readonly locals = new Map<string, RubyParameterNode>()

  visitERBStrictLocalsNode(node: ERBStrictLocalsNode): void {
    this.hasDeclaration = true

    for (const local of node.locals) {
      if (!isRubyParameterNode(local)) continue

      if (local.kind === KEYWORD_REST_KIND) {
        this.hasKeywordRest = true
        continue
      }

      if (local.kind !== KEYWORD_KIND) continue

      const name = local.name?.value

      if (name) this.locals.set(name, local)
    }
  }
}

export function strictLocalsDeclarationOf(document: DocumentNode): StrictLocalsDeclarationCollector {
  const collector = new StrictLocalsDeclarationCollector()

  collector.visit(document)

  return collector
}

export function isLocalAssignsRead(node: PrismNodes.Node | null): node is PrismNodes.CallNode {
  if (!isPrismNodeType(node, "CallNode")) return false
  if (node.receiver !== null) return false
  if (node.arguments_ !== null) return false

  return node.name === LOCAL_ASSIGNS
}

export function localAssignsLookupFor(node: PrismNodes.CallNode): LocalAssignsLookup | null {
  const presence = PRESENCE_LOOKUPS.includes(node.name)

  if (!presence && !VALUE_LOOKUPS.includes(node.name)) return null
  if (!isLocalAssignsRead(node.receiver)) return null

  const argumentNodes = node.arguments_?.arguments_ ?? []
  const [first, ...rest] = argumentNodes

  if (!isPrismNodeType(first, "SymbolNode")) return null
  if (rest.length > 0 && node.name !== "fetch") return null
  if (rest.length > 1) return null

  const name = first.unescaped?.value

  if (!name) return null

  return {
    name,
    method: node.name,
    presence,
    extraArguments: rest.length > 0,
    startOffset: node.location.startOffset,
    length: node.location.length,
  }
}

export function isRedundantLocalAssignsLookup(lookup: LocalAssignsLookup, declaration: StrictLocalsDeclarationCollector): boolean {
  const local = declaration.locals.get(lookup.name)

  if (!local) return !declaration.hasKeywordRest

  return local.required
}
