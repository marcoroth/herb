import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import { isOutputRender, renderPartialExpression } from "./prism-rule-utils.js"

import { isPrismNodeType, locationFromByteOffset, partialNameForFile } from "@herb-tools/core"

import type { ERBRenderNode, ParseResult, ParserOptions } from "@herb-tools/core"
import type { FullRuleConfig, LintContext, UnboundLintOffense } from "../types.js"

class ActionViewPreferQualifiedPartialPathVisitor extends BaseRuleVisitor {
  visitERBRenderNode(node: ERBRenderNode): void {
    this.checkRender(node)

    this.visitChildNodes(node)
  }

  private checkRender(node: ERBRenderNode): void {
    const call = node.prismNode
    const source = node.source

    if (!call || !source) return
    if (!isOutputRender(node)) return

    const expression = renderPartialExpression(call)

    if (!expression) return
    if (!isPrismNodeType(expression.node, "StringNode")) return

    const name = expression.node.unescaped?.value

    if (!name) return
    if (name.includes("/")) return

    this.addOffense(
      `The partial \`${name}\` is looked up relative to the directory of the template rendering it. Moving this template changes which file that resolves to, and renaming the partial means hunting for callers that never spell its full name. ${this.advice(name)}`,
      locationFromByteOffset(source, expression.node.location.startOffset, expression.node.location.length),
    )
  }

  private advice(name: string): string {
    const qualified = this.qualifiedNameFor(name)

    if (qualified) {
      return `Write it as \`${qualified}\` so it resolves to the same file from any template, and a search for \`${qualified}\` finds every caller.`
    }

    return `Write the full path from the view root so it resolves to the same file from any template, and a search for that path finds every caller.`
  }

  private qualifiedNameFor(name: string): string | null {
    const partials = this.context.partials

    if (!partials) return null

    const declaration = partials.lookup(name, this.context.fileName)

    if (!declaration) return null

    return partialNameForFile(declaration.file, partials.viewRoot)
  }
}

export class ActionViewPreferQualifiedPartialPathRule extends ParserRule {
  static ruleName = "actionview-prefer-qualified-partial-path"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "info",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      render_nodes: true,
      prism_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ActionViewPreferQualifiedPartialPathVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
