import { ParserRule } from "../types.js"
import { PrismVisitor, SourceOffsets, Visitor } from "@herb-tools/core"

import { isPrismNodeType } from "@herb-tools/core"

import type { ERBStrictLocalsNode, ParseResult, ParserOptions, PrismNodes } from "@herb-tools/core"
import type { FullRuleConfig, LintContext, UnboundLintOffense } from "../types.js"

const LOCAL_ASSIGNS = "local_assigns"
const DECLARATION = "`<%# locals: (...) %>`"

const VALUE_LOOKUPS = ["[]", "dig"]
const PRESENCE_LOOKUPS = ["key?", "has_key?", "include?", "member?"]
const FETCH = "fetch"

type ReadKind = "value" | "fetch" | "presence" | "other"

interface LocalAssignsRead {
  kind: ReadKind
  node: PrismNodes.CallNode
  name: string | null
}

class StrictLocalsDeclarationCollector extends Visitor {
  hasDeclaration = false

  visitERBStrictLocalsNode(_node: ERBStrictLocalsNode): void {
    this.hasDeclaration = true
  }
}

class LocalAssignsReadCollector extends PrismVisitor {
  readonly reads: LocalAssignsRead[] = []

  private readonly lookedUp = new Set<PrismNodes.CallNode>()

  override visitCallNode(node: PrismNodes.CallNode): void {
    const lookup = this.lookupFor(node)

    if (lookup) {
      this.lookedUp.add(node.receiver as PrismNodes.CallNode)
      this.reads.push(lookup)
    } else if (this.isLocalAssigns(node) && !this.lookedUp.has(node)) {
      this.reads.push({ kind: "other", node, name: null })
    }

    this.visitChildNodes(node)
  }

  private lookupFor(node: PrismNodes.CallNode): LocalAssignsRead | null {
    if (!this.isLocalAssigns(node.receiver)) return null

    const kind = this.kindOf(node.name)

    if (!kind) return null

    const [first] = node.arguments_?.arguments_ ?? []

    if (!isPrismNodeType(first, "SymbolNode")) return null

    const name = first.unescaped?.value

    if (!name) return null

    return { kind, node, name }
  }

  private kindOf(method: string): ReadKind | null {
    if (VALUE_LOOKUPS.includes(method)) return "value"
    if (PRESENCE_LOOKUPS.includes(method)) return "presence"
    if (method === FETCH) return "fetch"

    return null
  }

  private isLocalAssigns(node: PrismNodes.Node | null): node is PrismNodes.CallNode {
    if (!isPrismNodeType(node, "CallNode")) return false
    if (node.receiver !== null) return false
    if (node.arguments_ !== null) return false

    return node.name === LOCAL_ASSIGNS
  }
}

export class ActionViewNoLocalAssignsRule extends ParserRule {
  static ruleName = "actionview-no-local-assigns"
  static introducedIn = this.version("unreleased")
  static defaultEnabledIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "info",
      frameworks: ["actionview"],
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      strict_locals: true,
      prism_program: true,
    }
  }

  check(result: ParseResult, _context?: Partial<LintContext>): UnboundLintOffense[] {
    const document = result.value
    const source = document.source
    const program = document.prismNode

    if (!source || !program) return []

    const declaration = new StrictLocalsDeclarationCollector()

    declaration.visit(document)

    if (declaration.hasDeclaration) return []

    const collector = new LocalAssignsReadCollector()

    collector.visit(program)

    const offsets = new SourceOffsets(source)

    return collector.reads.map(read => {
      const { startOffset, length } = read.node.location
      const location = offsets.locationFromByteOffset(startOffset, length)

      return this.createOffense(this.messageFor(read, offsets), location)
    })
  }

  private messageFor(read: LocalAssignsRead, offsets: SourceOffsets): string {
    const code = this.codeOf(read.node, offsets)

    if (!read.name) {
      return `\`${code}\` is used in a template without a strict locals declaration. Declare the locals the template takes in a ${DECLARATION} declaration at the top of the template, so Rails raises when a caller passes one it does not list.`
    }

    const declared = this.declaredLocal(read, offsets)
    const declare = declared ? `Declare \`${declared}\`` : `Declare \`${read.name}\` with that default value`

    if (read.kind === "presence") {
      return `\`${code}\` checks for a local the template does not declare. ${declare} in a ${DECLARATION} declaration at the top of the template, and keep the check only if it needs to tell an omitted \`${read.name}\` from one passed as \`nil\`.`
    }

    return `\`${code}\` reads a local the template does not declare. ${declare} in a ${DECLARATION} declaration at the top of the template and read \`${this.replacementFor(read, offsets)}\` instead.`
  }

  private declaredLocal(read: LocalAssignsRead, offsets: SourceOffsets): string | null {
    if (read.kind !== "fetch") return `${read.name}: nil`
    if (read.node.block) return null

    const [, fallback, ...rest] = read.node.arguments_?.arguments_ ?? []

    if (!fallback) return `${read.name}:`
    if (rest.length > 0) return null

    const value = offsets.substringFromByteOffset(fallback.location.startOffset, fallback.location.length)

    if (value.includes("\n")) return null

    return `${read.name}: ${value}`
  }

  private replacementFor(read: LocalAssignsRead, offsets: SourceOffsets): string {
    const [first, ...rest] = read.node.arguments_?.arguments_ ?? []

    if (read.node.name !== "dig" || rest.length === 0 || !first) return read.name ?? LOCAL_ASSIGNS

    const lastArgument = rest[rest.length - 1]
    const start = rest[0].location.startOffset
    const end = lastArgument.location.startOffset + lastArgument.location.length
    const keys = offsets.substringFromByteOffset(start, end - start)

    return `${read.name}&.dig(${keys})`
  }

  private codeOf(node: PrismNodes.CallNode, offsets: SourceOffsets): string {
    const code = offsets.substringFromByteOffset(node.location.startOffset, node.location.length)

    return code.includes("\n") ? LOCAL_ASSIGNS : code
  }
}
