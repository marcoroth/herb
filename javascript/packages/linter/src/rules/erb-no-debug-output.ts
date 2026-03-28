import { PrismVisitor, isERBOutputNode } from "@herb-tools/core"
import type { ParseResult, ERBContentNode, ParserOptions, PrismNode } from "@herb-tools/core"

import { BaseRuleVisitor, locationFromOffset } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

const DEBUG_OUTPUT_METHODS = new Set(["p", "pp", "puts", "print", "warn", "debug", "byebug"])

const BINDING_DEBUGGER_METHODS = new Set(["pry", "irb"])

function isBindingDebuggerCall(node: PrismNode): boolean {
  if (!BINDING_DEBUGGER_METHODS.has(node.name)) return false
  if (node.receiver?.constructor?.name !== "CallNode") return false

  return node.receiver.name === "binding" && !node.receiver.receiver
}

class DebugOutputCallCollector extends PrismVisitor {
  public readonly calls: PrismNode[] = []

  visitCallNode(node: PrismNode): void {
    if (!node.receiver && DEBUG_OUTPUT_METHODS.has(node.name)) {
      this.calls.push(node)
    } else if (isBindingDebuggerCall(node)) {
      this.calls.push(node)
    }

    this.visitChildNodes(node)
  }
}

class ERBNoDebugOutputVisitor extends BaseRuleVisitor {
  visitERBContentNode(node: ERBContentNode): void {
    const prismNode = node.prismNode
    if (!prismNode) return

    const source = node.source
    if (!source) return

    const collector = new DebugOutputCallCollector()
    collector.visit(prismNode)

    for (const call of collector.calls) {
      const { startOffset, length } = call.location
      const location = locationFromOffset(source, startOffset, length)
      const callSource = source.substring(startOffset, startOffset + length)

      this.addOffense(
        `Avoid using \`${callSource}\` in ERB templates. Remove the debug output or use \`<%= ... %>\` to display content.`,
        location,
        undefined,
        undefined,
        ["unnecessary"],
      )
    }
  }
}

export class ERBNoDebugOutputRule extends ParserRule {
  static ruleName = "erb-no-debug-output"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoDebugOutputVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
