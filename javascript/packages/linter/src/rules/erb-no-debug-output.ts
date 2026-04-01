import { ParserRule } from "../types.js"
import { PrismVisitor } from "@herb-tools/core"

import { locationFromOffset } from "./rule-utils.js"
import { isDebugOutputCall } from "./prism-rule-utils.js"

import type { ParseResult, ParserOptions, PrismNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

class DebugOutputCallCollector extends PrismVisitor {
  public readonly calls: PrismNode[] = []

  visitCallNode(node: PrismNode): void {
    if (isDebugOutputCall(node)) {
      this.calls.push(node)
    }

    this.visitChildNodes(node)
  }
}

export class ERBNoDebugOutputRule extends ParserRule {
  static ruleName = "erb-no-debug-output"
  static introducedIn = this.version("0.9.3")

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
      prism_program: true,
    }
  }

  check(result: ParseResult, _context?: Partial<LintContext>): UnboundLintOffense[] {
    const source = result.value.source
    const prismNode = result.value.prismNode

    if (!prismNode || !source) return []

    const collector = new DebugOutputCallCollector()
    collector.visit(prismNode)

    return collector.calls.map(call => {
      const { startOffset, length } = call.location
      const location = locationFromOffset(source, startOffset, length)
      const callSource = source.substring(startOffset, startOffset + length)

      return this.createOffense(
        `Avoid using \`${callSource}\` in ERB templates. Remove the debug output or use \`<%= ... %>\` to display content.`,
        location,
      )
    })
  }
}
