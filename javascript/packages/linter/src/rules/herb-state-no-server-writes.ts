import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"
import { StateScopeMap, collectCountedFolds, declaredKind, isDerived } from "../utils/state-directives-utils.js"
import { mentionsAnyState } from "@herb-tools/client/directives"

import { PrismVisitor } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ParserOptions, PrismNode, ERBBlockNode, ERBContentNode, ERBIfNode, ERBUnlessNode, ERBCaseNode, ERBWhenNode, Node } from "@herb-tools/core"
import type { CountedFold } from "../utils/state-directives-utils.js"

class StateWriteCollector extends PrismVisitor {
  readonly assigned: string[] = []

  private stateNames: readonly string[]

  constructor(stateNames: readonly string[]) {
    super()

    this.stateNames = stateNames
  }

  static assignedNames(prism: PrismNode, states: readonly string[]): string[] {
    const collector = new StateWriteCollector(states)

    collector.visit(prism)

    return [...new Set(collector.assigned)]
  }

  private record(name: unknown): void {
    if (this.stateNames.includes(String(name))) this.assigned.push(String(name))
  }

  override visitLocalVariableWriteNode(node: PrismNode): void {
    this.record(node.name)
    super.visitLocalVariableWriteNode(node as never)
  }

  override visitLocalVariableOperatorWriteNode(node: PrismNode): void {
    this.record(node.name)
    super.visitLocalVariableOperatorWriteNode(node as never)
  }

  override visitLocalVariableOrWriteNode(node: PrismNode): void {
    this.record(node.name)
    super.visitLocalVariableOrWriteNode(node as never)
  }

  override visitLocalVariableAndWriteNode(node: PrismNode): void {
    this.record(node.name)
    super.visitLocalVariableAndWriteNode(node as never)
  }

  override visitLocalVariableTargetNode(node: PrismNode): void {
    this.record(node.name)
    super.visitLocalVariableTargetNode(node as never)
  }
}

interface CountRead {
  name: string
  location: Node["location"]
  order: number
  blocks: ERBBlockNode[]
}

class StateNoServerWritesVisitor extends BaseRuleVisitor {
  private states: StateScopeMap
  private folds: CountedFold[]
  private foldOrders = new Map<CountedFold, number>()
  private reads: CountRead[] = []
  private counted: Set<string>
  private stack: (ERBBlockNode | null)[] = [null]
  private order = 0

  constructor(ruleName: string, states: StateScopeMap, folds: CountedFold[], context?: Partial<LintContext>) {
    super(ruleName, context)

    this.states = states
    this.folds = folds
    this.counted = new Set(folds.map((fold) => fold.name))
  }

  visitERBBlockNode(node: ERBBlockNode): void {
    this.trackReads(node)
    this.stack.push(node)

    super.visitERBBlockNode(node)

    this.stack.pop()
  }

  visitERBIfNode(node: ERBIfNode): void {
    const fold = this.folds.find((candidate) => candidate.anchor === node)

    if (fold) {
      this.foldOrders.set(fold, this.order += 1)
      this.checkFold(fold)

      return
    }

    this.trackReads(node)

    super.visitERBIfNode(node)
  }

  visitERBUnlessNode(node: ERBUnlessNode): void {
    this.trackReads(node)

    super.visitERBUnlessNode(node)
  }

  visitERBCaseNode(node: ERBCaseNode): void {
    this.trackReads(node)

    super.visitERBCaseNode(node)
  }

  visitERBWhenNode(node: ERBWhenNode): void {
    this.trackReads(node)

    super.visitERBWhenNode(node)
  }

  visitERBContentNode(node: ERBContentNode): void {
    const tag = node.tag_opening?.value

    if (tag !== "<%" && tag !== "<%=" && tag !== "<%==") return

    const fold = this.folds.find((candidate) => candidate.anchor === node)

    if (fold) {
      this.foldOrders.set(fold, this.order += 1)
      this.checkFold(fold)

      return
    }

    this.trackReads(node)

    const names = this.states.namesIn(this.stack)

    if (names.length === 0) return

    const prism = node.prismNode

    if (!prism) return

    const assigned = StateWriteCollector.assignedNames(prism, names)

    if (assigned.length === 0) return

    const content = (node.content?.value ?? "").trim()

    this.addOffense(
      `\`${tag} ${content} %>\` assigns the state \`${assigned[0]}\`. The client never sees a server-side write, so the value it holds would drift from the one the server rendered. Seed the initial value in the declaration, derive it from other states, count items with \`${assigned[0]} += 1\` behind a state condition in a keyed loop, or write it at runtime with \`data-herb-set\` or \`state.set\`.`,
      node.location,
    )
  }

  reportCountReads(): void {
    for (const fold of this.folds) {
      const foldOrder = this.foldOrders.get(fold) ?? 0

      for (const read of this.reads) {
        if (read.name !== fold.name) continue

        if (read.order < foldOrder) {
          this.addOffense(
            `\`${fold.name}\` is read before its count is complete. The server renders that read mid-count and the client cannot keep it current. Move the read below the loop that counts \`${fold.name}\`.`,
            read.location,
          )

          continue
        }

        if (read.blocks.includes(fold.block)) {
          this.addOffense(
            `\`${fold.name}\` is read inside the loop that counts it. The count is complete only after the loop. Move the read below the loop.`,
            read.location,
          )
        }
      }
    }
  }

  private checkFold(fold: CountedFold): void {
    const declaration = this.states.resolve(this.stack, fold.name)

    if (!declaration) return

    const region = this.states.resolve([null], fold.name)
    const spelled = `${fold.name} += ${fold.by}`

    if (!region) {
      this.addOffense(
        `\`${spelled}\` counts into \`${fold.name}\`, which is an item state. A count lives once per region, not once per item. Declare \`${fold.name}\` at the top of the template, outside the loop.`,
        fold.assignment.location,
      )

      return
    }

    if (isDerived(region)) {
      this.addOffense(
        `\`${spelled}\` counts into \`${fold.name}\`, which is derived from \`${region.defaultSource}\`. A state is either derived or counted, never both. Drop the derivation from \`${fold.name}\`, or count into a second state.`,
        fold.assignment.location,
      )

      return
    }

    const kind = declaredKind(region)

    if (kind !== "integer") {
      this.addOffense(
        `\`${spelled}\` counts into the ${kind.charAt(0).toUpperCase() + kind.slice(1)} state \`${fold.name}\`. A count is a number. Declare \`${fold.name}\` as an Integer, like \`(${fold.name}: 0)\`.`,
        fold.assignment.location,
      )

      return
    }

    if (this.folds.some((other) => other !== fold && other.name === fold.name && (this.foldOrders.get(other) ?? Infinity) < (this.foldOrders.get(fold) ?? 0))) {
      this.addOffense(
        `\`${fold.name}\` is counted twice. One state holds one count. Declare a second state for the second count.`,
        fold.assignment.location,
      )
    }
  }

  private trackReads(node: { content?: { value?: string } | null; location: Node["location"] }): void {
    if (this.counted.size === 0) return

    const content = node.content?.value ?? ""

    if (content === "") return

    for (const name of this.counted) {
      if (!mentionsAnyState(content, [name])) continue

      this.reads.push({
        name,
        location: node.location,
        order: this.order += 1,
        blocks: this.stack.filter((entry): entry is ERBBlockNode => entry !== null),
      })
    }
  }
}

export class HerbStateNoServerWritesRule extends ParserRule {
  static ruleName = "herb-state-no-server-writes"
  static introducedIn = this.version("unreleased")

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_nodes: true,
    }
  }

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const states = StateScopeMap.collect(result.value)

    if (!states.hasDeclarations) return []

    const folds = collectCountedFolds(result.value, states)
    const visitor = new StateNoServerWritesVisitor(this.ruleName, states, folds, context)

    visitor.visit(result.value)
    visitor.reportCountReads()

    return visitor.offenses
  }
}
