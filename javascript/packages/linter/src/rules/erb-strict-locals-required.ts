import { SourceRule } from "../types.js"
import { Location } from "@herb-tools/core"
import { BaseSourceRuleVisitor } from "./rule-utils.js"

import { isPartialFile } from "./file-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

function hasStrictLocals(source: string): boolean {
  return source.includes("<%# locals:") || source.includes("<%#locals:")
}

class ERBStrictLocalsRequiredVisitor extends BaseSourceRuleVisitor {
  protected visitSource(source: string): void {
    const isPartial = isPartialFile(this.context.fileName)

    if (isPartial !== true) return
    if (hasStrictLocals(source)) return

    const firstLineLength = source.indexOf("\n") === -1 ? source.length : source.indexOf("\n")
    const location = Location.from(1, 0, 1, firstLineLength)

    this.addOffense(
      "Partial is missing a strict locals declaration. Add `<%# locals: (...) %>` at the top of the file.",
      location
    )
  }
}

export class ERBStrictLocalsRequiredRule extends SourceRule {
  name = "erb-strict-locals-required"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "error",
    }
  }

  check(source: string, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBStrictLocalsRequiredVisitor(this.name, context)

    visitor.visit(source)

    return visitor.offenses
  }
}
