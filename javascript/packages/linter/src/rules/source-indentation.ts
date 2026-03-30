import { Location } from "@herb-tools/core"

import { BaseSourceRuleVisitor, positionFromOffset } from "./rule-utils.js"
import { SourceRule } from "../types.js"
import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"

const START_BLANKS = /^[^\S\n]*\t[^\S\n]*/

class SourceIndentationVisitor extends BaseSourceRuleVisitor {
  protected visitSource(source: string): void {
    const lines = source.split("\n")
    let offset = 0

    lines.forEach((line) => {
      const match = line.match(START_BLANKS)

      if (match) {
        const start = positionFromOffset(source, offset)
        const end = positionFromOffset(source, offset + match[0].length)
        const location = new Location(start, end)

        this.addOffense(
          "Indent with spaces instead of tabs.",
          location,
        )
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
    const lines = source.split("\n")
    const result = lines.map((line) => {
      const match = line.match(START_BLANKS)

      if (match) {
        const replaced = match[0].replace(/\t/g, " ".repeat(indentWidth))
        return replaced + line.substring(match[0].length)
      }

      return line
    })

    return result.join("\n")
  }
}
