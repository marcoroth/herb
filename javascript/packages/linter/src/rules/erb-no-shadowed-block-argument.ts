import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

import { isRubyParameterNode, isPrismNodeType, locationFromByteOffset } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ParserOptions, ERBBlockNode, ERBForNode, ERBRenderNode, Location, Node, PrismNode } from "@herb-tools/core"

interface Binding {
  name: string
  location: Location
}

class NoShadowedBlockArgumentVisitor extends BaseRuleVisitor {
  private scopes: string[][] = []

  visitERBBlockNode(node: ERBBlockNode): void {
    this.withScope(this.bindingsFromParameters(node.block_arguments), () => super.visitERBBlockNode(node))
  }

  visitERBRenderNode(node: ERBRenderNode): void {
    this.withScope(this.bindingsFromParameters(node.block_arguments), () => super.visitERBRenderNode(node))
  }

  visitERBForNode(node: ERBForNode): void {
    this.withScope(this.bindingsFromForLoop(node), () => super.visitERBForNode(node))
  }

  private withScope(bindings: Binding[], visitChildren: () => void): void {
    const enclosing = this.scopes.flat()

    for (const binding of bindings) {
      if (!enclosing.includes(binding.name)) continue

      this.addOffense(
        `Block argument \`${binding.name}\` shadows an outer \`${binding.name}\`. Rename it so both remain reachable.`,
        binding.location,
      )
    }

    this.scopes.push(bindings.map(binding => binding.name))

    visitChildren()

    this.scopes.pop()
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

export class ERBNoShadowedBlockArgumentRule extends ParserRule {
  static ruleName = "erb-no-shadowed-block-argument"
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
    const visitor = new NoShadowedBlockArgumentVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
