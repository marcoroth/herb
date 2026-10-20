import { ParserRule } from "../types.js"
import { PrismVisitor, Visitor } from "@herb-tools/core"

import { isPrismNodeType, locationFromByteOffset } from "@herb-tools/core"

import type { ERBStrictLocalsNode, ParseResult, ParserOptions, PrismNodes } from "@herb-tools/core"
import type { FullRuleConfig, LintContext, UnboundLintOffense } from "../types.js"

const LOCAL_ASSIGNS = "local_assigns"
const LOOKUPS = ["[]", "fetch", "dig", "key?", "has_key?", "include?", "member?"]

interface LocalAssignsRead {
  name: string | null
  startOffset: number
  length: number
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
    const name = this.lookupName(node)

    if (name) {
      this.lookedUp.add(node.receiver as PrismNodes.CallNode)
      this.reads.push({ name, startOffset: node.location.startOffset, length: node.location.length })
    } else if (this.isLocalAssigns(node) && !this.lookedUp.has(node)) {
      this.reads.push({ name: null, startOffset: node.location.startOffset, length: node.location.length })
    }

    this.visitChildNodes(node)
  }

  private lookupName(node: PrismNodes.CallNode): string | null {
    if (!LOOKUPS.includes(node.name)) return null
    if (!this.isLocalAssigns(node.receiver)) return null

    const [first] = node.arguments_?.arguments_ ?? []

    if (!isPrismNodeType(first, "SymbolNode")) return null

    return first.unescaped?.value || null
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

    return collector.reads.map(read => {
      const location = locationFromByteOffset(source, read.startOffset, read.length)

      return this.createOffense(this.messageFor(read), location)
    })
  }

  private messageFor(read: LocalAssignsRead): string {
    if (read.name) {
      return `Declare \`${read.name}\` in a \`<%# locals: (...) %>\` declaration and read it by name instead of through \`${LOCAL_ASSIGNS}\`. A declaration documents which locals the template takes, and Rails raises when a caller passes one it does not list.`
    }

    return `Declare the template's locals in a \`<%# locals: (...) %>\` declaration and read them by name instead of through \`${LOCAL_ASSIGNS}\`. A declaration documents which locals the template takes, and Rails raises when a caller passes one it does not list.`
  }
}
