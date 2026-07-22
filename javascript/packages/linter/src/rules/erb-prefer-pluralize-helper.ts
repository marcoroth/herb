import { ParserRule } from "../types.js"
import { PrismVisitor, isPrismNodeType } from "@herb-tools/core"

import { locationFromOffset } from "./rule-utils.js"

import type { ParseResult, ParserOptions, PrismNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

class StringPluralizeCallCollector extends PrismVisitor {
  public readonly calls: PrismNode[] = []

  visitCallNode(node: PrismNode): void {
    if (this.isStringPluralizeWithCount(node)) {
      this.calls.push(node)
    }

    this.visitChildNodes(node)
  }

  private isStringPluralizeWithCount(node: PrismNode): boolean {
    if (node.name !== "pluralize") return false

    const receiver = node.receiver

    if (!isPrismNodeType(receiver, "StringNode") && !isPrismNodeType(receiver, "InterpolatedStringNode")) {
      return false
    }

    const args = node.arguments_?.arguments_

    return Array.isArray(args) && args.length > 0
  }
}

export class ERBPreferPluralizeHelperRule extends ParserRule {
  static ruleName = "erb-prefer-pluralize-helper"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_program: true,
    }
  }

  check(result: ParseResult, _context?: Partial<LintContext>): UnboundLintOffense[] {
    const source = result.value.source
    const prismNode = result.value.prismNode

    if (!prismNode || !source) return []

    const collector = new StringPluralizeCallCollector()
    collector.visit(prismNode)

    const slice = (node: PrismNode) =>
      source.substring(node.location.startOffset, node.location.startOffset + node.location.length)

    return collector.calls.map(call => {
      const location = locationFromOffset(source, call.location.startOffset, call.location.length)
      const suggestion = `pluralize(${slice(call.receiver)}, ${slice(call.arguments_)})`

      return this.createOffense(
        `Prefer the \`pluralize\` helper over \`String#pluralize\` for counts. Use \`<%= ${suggestion} %>\` instead.`,
        location,
      )
    })
  }
}
