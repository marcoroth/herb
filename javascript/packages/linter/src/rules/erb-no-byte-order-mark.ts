import { BYTE_ORDER_MARK, Location, positionFromOffset } from "@herb-tools/core"

import { BaseSourceRuleVisitor } from "./rule-utils.js"
import { SourceRule } from "../types.js"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"

class ERBNoByteOrderMarkVisitor extends BaseSourceRuleVisitor {
  protected visitSource(source: string): void {
    if (!source.startsWith(BYTE_ORDER_MARK)) return

    const start = positionFromOffset(source, 0)
    const end = positionFromOffset(source, BYTE_ORDER_MARK.length)

    this.addOffense(
      "Remove the byte order mark from the start of the file. It is an encoding signature, not template content, so it renders as an invisible character ahead of everything else and can push browsers into quirks mode. Save the file as UTF-8 without a BOM.",
      new Location(start, end),
    )
  }
}

export class ERBNoByteOrderMarkRule extends SourceRule {
  static autocorrectable = true
  static ruleName = "erb-no-byte-order-mark"
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

  check(source: string, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoByteOrderMarkVisitor(this.ruleName, context)

    visitor.visit(source)

    return visitor.offenses
  }

  autofix(_offense: LintOffense, source: string, _context?: Partial<LintContext>): string | null {
    if (!source.startsWith(BYTE_ORDER_MARK)) return null

    return source.slice(BYTE_ORDER_MARK.length)
  }
}
