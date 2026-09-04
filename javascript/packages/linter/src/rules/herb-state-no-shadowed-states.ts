import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { isStateDirective, stateSignatureOf } from "../utils/state-directives-utils.js"

import { isRubyParameterNode, isPrismNodeType, locationFromByteOffset } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ParserOptions, ERBBlockNode, ERBContentNode, ERBForNode, ERBRenderNode, Location, Node, PrismNode } from "@herb-tools/core"

interface Binding {
  name: string
  location: Location
}

class DeclaredStatesVisitor extends BaseRuleVisitor {
  public readonly names = new Set<string>()

  visitERBContentNode(node: ERBContentNode): void {
    if (!isStateDirective(node)) return

    const parsed = stateSignatureOf(node)

    if (!parsed || parsed.malformed) return

    for (const declaration of parsed.declarations) {
      this.names.add(declaration.name)
    }
  }
}

class NoShadowedStatesVisitor extends BaseRuleVisitor {
  private states: Set<string>

  constructor(ruleName: string, states: Set<string>, context?: Partial<LintContext>) {
    super(ruleName, context)

    this.states = states
  }

  visitERBBlockNode(node: ERBBlockNode): void {
    this.checkBindings(this.bindingsFromParameters(node.block_arguments))

    super.visitERBBlockNode(node)
  }

  visitERBRenderNode(node: ERBRenderNode): void {
    this.checkBindings(this.bindingsFromParameters(node.block_arguments))

    super.visitERBRenderNode(node)
  }

  visitERBForNode(node: ERBForNode): void {
    this.checkBindings(this.bindingsFromForLoop(node))

    super.visitERBForNode(node)
  }

  private checkBindings(bindings: Binding[]): void {
    for (const binding of bindings) {
      if (!this.states.has(binding.name)) continue

      this.addOffense(
        `Block argument \`${binding.name}\` shadows the state \`${binding.name}\`, so reads inside this block reach the argument and never the state. Rename the argument.`,
        binding.location,
      )
    }
  }

  private bindingsFromParameters(parameters: Node[]): Binding[] {
    return parameters.filter(isRubyParameterNode).flatMap(parameter => {
      const name = parameter.name?.value

      return name ? [{ name, location: parameter.location }] : []
    })
  }

  private bindingsFromForLoop(node: ERBForNode): Binding[] {
    const { prismNode, source } = node

    if (!prismNode || !isPrismNodeType(prismNode, "ForNode") || !source) return []

    const index = prismNode.index

    if (!index) return []

    const targets = isPrismNodeType(index, "MultiTargetNode") ? (index.lefts ?? []) : [index]

    return targets.flatMap((target: PrismNode) => {
      if (typeof target?.name !== "string") return []

      const location = target.nameLoc ?? target.location

      if (!location) return []

      return [{ name: target.name, location: locationFromByteOffset(source, location.startOffset, location.length) }]
    })
  }
}

export class HerbStateNoShadowedStatesRule extends ParserRule {
  static ruleName = "herb-state-no-shadowed-states"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const declared = new DeclaredStatesVisitor(this.ruleName, context)

    declared.visit(result.value)

    if (declared.names.size === 0) return []

    const visitor = new NoShadowedStatesVisitor(this.ruleName, declared.names, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
