import { Location } from "@herb-tools/core"

import { BaseSourceRuleVisitor } from "./rule-utils.js"
import { positionFromOffset } from "@herb-tools/core"
import { convertIndentation, LEADING_BLANKS } from "@herb-tools/printer"
import { SourceRule } from "../types.js"
import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"

class SourceIndentationVisitor extends BaseSourceRuleVisitor {
  protected visitSource(source: string): void {
    const indentStyle = this.context.indentStyle ?? "space"
    const disallowedChar = indentStyle === "tab" ? " " : "\t"
    const message = indentStyle === "tab" ? "Indent with tabs instead of spaces." : "Indent with spaces instead of tabs."

    const lines = source.split("\n")
    let offset = 0

    lines.forEach((line) => {
      const match = line.match(LEADING_BLANKS)
      const leading = match ? match[0] : ""

      if (leading.includes(disallowedChar)) {
        const start = positionFromOffset(source, offset)
        const end = positionFromOffset(source, offset + leading.length)
        const location = new Location(start, end)

        this.addOffense(message, location)
      }

      offset += line.length + 1
    })
  }
}

export class SourceIndentationRule extends SourceRule {
  static autocorrectable = true
  static ruleName = "source-indentation"
  static introducedIn = this.version("0.9.3")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(source: string, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new SourceIndentationVisitor(this.ruleName, context)

    visitor.visit(source)

    return visitor.offenses
  }

  autofix(_offense: LintOffense, source: string, context?: Partial<LintContext>): string | null {
    const indentWidth = context?.indentWidth ?? 2
    const indentStyle = context?.indentStyle ?? "space"

    return convertIndentation(source, indentWidth, indentStyle)
  }
}
