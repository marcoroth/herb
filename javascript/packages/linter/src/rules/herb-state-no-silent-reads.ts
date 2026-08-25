import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"
import { StateScopeMap } from "../utils/state-directives-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBBlockNode, ERBContentNode } from "@herb-tools/core"

const BARE_READ = /^[a-z_][a-zA-Z0-9_]*\??$/

class StateNoSilentReadsVisitor extends BaseRuleVisitor {
  private states: StateScopeMap
  private stack: (ERBBlockNode | null)[] = [null]

  constructor(ruleName: string, states: StateScopeMap, context?: Partial<LintContext>) {
    super(ruleName, context)

    this.states = states
  }

  visitERBBlockNode(node: ERBBlockNode): void {
    this.stack.push(node)

    super.visitERBBlockNode(node)

    this.stack.pop()
  }

  visitERBContentNode(node: ERBContentNode): void {
    if (node.tag_opening?.value !== "<%") return

    const expression = node.content?.value.trim() ?? ""

    if (!BARE_READ.test(expression)) return

    const name = expression.endsWith("?") ? expression.slice(0, -1) : expression

    if (!this.states.resolve(this.stack, name)) return

    this.addOffense(
      `\`<% ${expression} %>\` reads the state \`${name}\` and discards the value, so it renders nothing and changes nothing. Show it with \`<%= ${name} %>\`, or write it from markup with \`data-herb-set\`.`,
      node.location,
      undefined,
      undefined,
      ["unnecessary"],
    )
  }
}

export class HerbStateNoSilentReadsRule extends ParserRule {
  static ruleName = "herb-state-no-silent-reads"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: {
        cli: "error",
        editor: "info",
      }
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const states = StateScopeMap.collect(result.value)

    if (!states.hasDeclarations) return []

    const visitor = new StateNoSilentReadsVisitor(this.ruleName, states, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
