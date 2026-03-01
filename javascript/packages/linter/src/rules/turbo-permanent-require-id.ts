import { BaseRuleVisitor, getAttribute } from "./rule-utils.js"

import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLOpenTagNode, ParseResult } from "@herb-tools/core"

class TurboPermanentRequireIdVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkTurboPermanent(node)
    super.visitHTMLOpenTagNode(node)
  }

  private checkTurboPermanent(node: HTMLOpenTagNode): void {
    const turboPermanentAttribute = getAttribute(node, "data-turbo-permanent")

    if (!turboPermanentAttribute) {
      return
    }

    const idAttribute = getAttribute(node, "id")

    if (!idAttribute) {
      this.addOffense(
        "Elements with `data-turbo-permanent` must have an `id` attribute. Without an `id`, Turbo can't track the element across page changes and the permanent behavior won't work as expected.",
        turboPermanentAttribute.location,
      )
    }
  }
}

export class TurboPermanentRequireIdRule extends ParserRule {
  name = "turbo-permanent-require-id"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new TurboPermanentRequireIdVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
