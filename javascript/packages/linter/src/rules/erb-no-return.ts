import {
  PrismVisitor,
  PrismNodes,
  locationFromByteOffset,
} from "@herb-tools/core"
import type { ParseResult, ParserOptions } from "@herb-tools/core"

import { ParserRule } from "../types.js"
import type {
  FullRuleConfig,
  LintContext,
  UnboundLintOffense,
} from "../types.js"

class ReturnCollector extends PrismVisitor {
  readonly returns: PrismNodes.ReturnNode[] = []

  override visitReturnNode(node: PrismNodes.ReturnNode): void {
    this.returns.push(node)
    this.visitChildNodes(node)
  }
}

export class ERBNoReturnRule extends ParserRule {
  static ruleName = "erb-no-return"
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

  check(
    result: ParseResult,
    _context?: Partial<LintContext>,
  ): UnboundLintOffense[] {
    const source = result.value.source
    if (!source) return []

    const program = result.value.prismNode
    if (!program) return []

    const collector = new ReturnCollector()
    collector.visit(program)

    return collector.returns.map((returnNode) => {
      const { startOffset, length } = returnNode.keywordLoc

      return this.createOffense(
        "Avoid using `return` in ERB templates. Use a conditional or move the logic to a controller or component.",
        locationFromByteOffset(source, startOffset, length),
      )
    })
  }
}
