import { SourceRule } from "../types.js"
import { Location } from "@herb-tools/core"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig, BaseAutofixContext } from "../types.js"
import type { Node } from "@herb-tools/core"

interface HerbCounterUnnecessaryAutofixContext extends BaseAutofixContext {
  line: number
  raw: string
}

/**
 * Report every `<%# herb:counter RULE N %>` comment whose rule now has zero
 * offenses in the file. Autofix deletes the entire comment line, including
 * its trailing newline (matching the spec so a first-line counter comment
 * doesn't leave a stray blank at the top of the file).
 *
 * Feeds off `context.counterDriftByRule`, populated by `Linter#lint` after
 * the main rule loop.
 */
export class HerbCounterCommentUnnecessaryRule extends SourceRule<HerbCounterUnnecessaryAutofixContext> {
  static ruleName = "herb-counter-comment-unnecessary"
  static introducedIn = this.version("unreleased")
  static autocorrectable = true

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
    }
  }

  check(_source: string, context?: Partial<LintContext>): UnboundLintOffense<HerbCounterUnnecessaryAutofixContext>[] {
    const drift = context?.counterDriftByRule
    if (!drift) return []

    const offenses: UnboundLintOffense<HerbCounterUnnecessaryAutofixContext>[] = []

    for (const entry of drift.values()) {
      if (entry.actual !== 0) continue
      if (entry.expected === 0) continue // nothing to warn about; declaring 0 is meaningless but not this rule's concern

      const location = Location.from(entry.line, entry.column, entry.line, entry.column + entry.raw.length)
      const message = `No offenses from \`${entry.ruleName}\` in this file. Remove the \`herb:counter\` comment.`

      offenses.push(this.createOffense(message, location, {
        node: null as any as Node,
        line: entry.line,
        raw: entry.raw,
      }))
    }

    return offenses
  }

  autofix(offense: LintOffense<HerbCounterUnnecessaryAutofixContext>, source: string): string | null {
    if (!offense.autofixContext) return null

    const { line, raw } = offense.autofixContext
    const lines = source.split("\n")
    const idx = line - 1

    if (idx < 0 || idx >= lines.length) return null

    const original = lines[idx]

    if (!original.includes(raw)) return null

    // If the comment is the only content on the line (ignoring surrounding
    // whitespace), delete the whole line and its trailing newline. Otherwise
    // strip just the comment (and one preceding space, if any).
    const stripped = original.replace(raw, "").replace(/[ \t]+$/, "")

    if (stripped.trim().length === 0) {
      lines.splice(idx, 1)
    } else {
      lines[idx] = stripped
    }

    return lines.join("\n")
  }
}
