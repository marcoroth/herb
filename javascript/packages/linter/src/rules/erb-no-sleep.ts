import { ParserRule } from "../types.js"
import { PrismVisitor, substringFromByteOffset , locationFromByteOffset } from "@herb-tools/core"

import { isSleepCall } from "./prism-rule-utils.js"

import type { ParseResult, ParserOptions, PrismNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

class SleepCallCollector extends PrismVisitor {
  public readonly calls: PrismNode[] = []

  visitCallNode(node: PrismNode): void {
    if (isSleepCall(node)) {
      this.calls.push(node)
    }

    this.visitChildNodes(node)
  }
}

export class ERBNoSleepRule extends ParserRule {
  static ruleName = "erb-no-sleep"
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
      prism_program: true,
    }
  }

  check(result: ParseResult, _context?: Partial<LintContext>): UnboundLintOffense[] {
    const source = result.value.source
    const prismNode = result.value.prismNode

    if (!prismNode || !source) return []

    const collector = new SleepCallCollector()
    collector.visit(prismNode)

    return collector.calls.map(call => {
      const { startOffset, length } = call.location
      const location = locationFromByteOffset(source, startOffset, length)
      const callSource = substringFromByteOffset(source, startOffset, length)

      return this.createOffense(
        `Avoid using \`${callSource}\` in ERB templates. It blocks the thread rendering the response and delays the page for every request. Remove it, or move the delay outside of the template.`,
        location,
      )
    })
  }
}
