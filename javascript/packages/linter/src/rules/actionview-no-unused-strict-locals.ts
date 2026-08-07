import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import { PrismVisitor } from "@herb-tools/core"

import { isPrismNodeType, isRubyParameterNode } from "@herb-tools/core"
import { isPartialFile } from "./file-utils.js"

import type { ERBStrictLocalsNode, ParseResult, ParserOptions, PrismNodes, RubyParameterNode } from "@herb-tools/core"
import type { FullRuleConfig, LintContext, UnboundLintOffense } from "../types.js"

const IGNORED_PREFIX = "_"
const REPORTED_KIND = "keyword"
const LOCAL_ASSIGNS = "local_assigns"
const LOCAL_ASSIGNS_LOOKUPS = ["[]", "fetch", "dig", "key?", "has_key?", "include?", "member?"]

class LocalReferenceCollector extends PrismVisitor {
  readonly names = new Set<string>()

  private readonly localAssignsReads = new Set<PrismNodes.CallNode>()
  private readonly lookedUpLocalAssignsReads = new Set<PrismNodes.CallNode>()

  get forwardsEveryLocal(): boolean {
    return [...this.localAssignsReads].some(read => !this.lookedUpLocalAssignsReads.has(read))
  }

  override visitCallNode(node: PrismNodes.CallNode): void {
    if (node.receiver === null) {
      this.names.add(node.name)

      if (node.name === LOCAL_ASSIGNS) this.localAssignsReads.add(node)
    } else if (this.isLocalAssignsLookup(node)) {
      for (const symbol of this.symbolArguments(node)) this.names.add(symbol)

      this.lookedUpLocalAssignsReads.add(node.receiver as PrismNodes.CallNode)
    }

    this.visitChildNodes(node)
  }

  override visitLocalVariableReadNode(node: PrismNodes.LocalVariableReadNode): void {
    this.names.add(node.name)

    this.visitChildNodes(node)
  }

  override visitLocalVariableOperatorWriteNode(node: PrismNodes.LocalVariableOperatorWriteNode): void {
    this.names.add(node.name)

    this.visitChildNodes(node)
  }

  override visitLocalVariableAndWriteNode(node: PrismNodes.LocalVariableAndWriteNode): void {
    this.names.add(node.name)

    this.visitChildNodes(node)
  }

  override visitLocalVariableOrWriteNode(node: PrismNodes.LocalVariableOrWriteNode): void {
    this.names.add(node.name)

    this.visitChildNodes(node)
  }

  private isLocalAssignsLookup(node: PrismNodes.CallNode): boolean {
    if (!LOCAL_ASSIGNS_LOOKUPS.includes(node.name)) return false
    if (!isPrismNodeType(node.receiver, "CallNode")) return false
    if (node.receiver.receiver !== null) return false
    if (node.receiver.name !== LOCAL_ASSIGNS) return false

    return this.symbolArguments(node).length > 0
  }

  private symbolArguments(node: PrismNodes.CallNode): string[] {
    const argumentNodes = node.arguments_?.arguments_ ?? []

    return argumentNodes.flatMap(argument => {
      if (!isPrismNodeType(argument, "SymbolNode")) return []

      const name = argument.unescaped?.value

      return name ? [name] : []
    })
  }
}

class ActionViewNoUnusedStrictLocalsVisitor extends BaseRuleVisitor {
  private readonly references: Set<string>

  constructor(ruleName: string, references: Set<string>, context?: Partial<LintContext>) {
    super(ruleName, context)

    this.references = references
  }

  visitERBStrictLocalsNode(node: ERBStrictLocalsNode): void {
    for (const local of node.locals) {
      if (!isRubyParameterNode(local)) continue
      if (local.kind !== REPORTED_KIND) continue

      const name = local.name?.value

      if (!name) continue
      if (name.startsWith(IGNORED_PREFIX)) continue
      if (this.references.has(name)) continue
      if (this.isUsedInDefaultValue(node, name)) continue

      this.addOffense(
        `Strict local \`${name}\` is never used in this partial. ${this.contractFor(local, name)} Remove it from the \`locals:\` declaration and from the call sites.`,
        local.location,
        undefined,
        undefined,
        ["unnecessary"],
      )
    }
  }

  private contractFor(local: RubyParameterNode, name: string): string {
    return local.required
      ? `Callers have to pass \`${name}:\` for a value the template never renders.`
      : `Callers can pass \`${name}:\` for a value the template never renders.`
  }

  private isUsedInDefaultValue(node: ERBStrictLocalsNode, name: string): boolean {
    const pattern = new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`)

    return node.locals.some(local => {
      if (!isRubyParameterNode(local)) return false
      if (local.name?.value === name) return false
      if (!local.default_value) return false

      return pattern.test(local.default_value.content)
    })
  }
}

export class ActionViewNoUnusedStrictLocalsRule extends ParserRule {
  static ruleName = "actionview-no-unused-strict-locals"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: {
        cli: "error",
        editor: "info",
      },
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      strict_locals: true,
      prism_program: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    if (isPartialFile(context?.fileName) === false) return []

    const program = result.value.prismNode

    if (!program) return []

    const collector = new LocalReferenceCollector()

    collector.visit(program)

    if (collector.forwardsEveryLocal) return []

    const visitor = new ActionViewNoUnusedStrictLocalsVisitor(this.ruleName, collector.names, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
