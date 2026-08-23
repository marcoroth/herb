import { BaseRuleVisitor, locationFromContentOffset } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"
import { isERBComment } from "../utils/state-directives-utils.js"

import { Location } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBContentNode } from "@herb-tools/core"

const SLOTS_DIRECTIVE = /^(-?\s*)(herb:slots)\b(.*?)-?\s*$/s
const RESOLVED_MODE = /\b(server|client)\b/
const MODES = new Set(["client", "server"])

class SlotsValidModeVisitor extends BaseRuleVisitor {
  visitERBContentNode(node: ERBContentNode): void {
    if (!isERBComment(node)) return

    const content = node.content?.value ?? ""
    const match = SLOTS_DIRECTIVE.exec(content)

    if (!match) return

    const remainder = match[3]
    const tokens = remainder.split(/\s+/).filter((token) => token !== "" && token !== "-")

    if (tokens.length === 0) return
    if (tokens.length === 1 && MODES.has(tokens[0])) return

    const spelled = tokens.join(" ")
    const resolved = RESOLVED_MODE.exec(remainder)?.[1] ?? "server"

    this.addOffense(
      `\`herb:slots ${spelled}\` does not name a single mode, and the engine silently resolves it to \`${resolved}\`. Write \`<%# herb:slots client %>\` or \`<%# herb:slots server %>\`.`,
      this.optionLocation(node, match[1].length + match[2].length, remainder, tokens),
    )
  }

  private optionLocation(node: ERBContentNode, remainderOffset: number, remainder: string, tokens: string[]): Location {
    const content = node.content

    if (!content) return node.location

    const first = remainder.indexOf(tokens[0])
    const lastToken = tokens[tokens.length - 1]
    const last = remainder.lastIndexOf(lastToken) + lastToken.length

    const base = content.location.start
    const start = locationFromContentOffset(base.line, base.column, content.value, remainderOffset + first).start
    const end = locationFromContentOffset(base.line, base.column, content.value, remainderOffset + last).start

    return new Location(start, end)
  }
}

export class HerbSlotsValidModeRule extends ParserRule {
  static ruleName = "herb-slots-valid-mode"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new SlotsValidModeVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
