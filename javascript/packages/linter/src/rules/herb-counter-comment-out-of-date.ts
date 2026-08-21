import { SourceRule } from "../types.js"
import { Location } from "@herb-tools/core"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig, BaseAutofixContext } from "../types.js"
import type { Node } from "@herb-tools/core"

interface HerbCounterOutOfDateAutofixContext extends BaseAutofixContext {
  line: number
  raw: string
  currentCount: number
  desiredCount: number
}

/**
 * Report every `<%# herb:counter RULE N %>` comment where the declared count
 * (E) does not match the actual number of offenses for that rule (N) in the
 * file, after herb:disable filtering.
 *
 * - When N > E: the linter still reports every actual offense (intentional
 *   divergence from erb_lint) *and* emits this rule on the comment so the
 *   developer sees both the drift and the offending code.
 * - When 0 < N < E: the actual offenses are suppressed (they still ratchet),
 *   and this rule fires so the developer can rewrite E to N. Autofixable.
 *
 * The per-rule drift map is built in `Linter#lint` and delivered via
 * `context.counterDriftByRule`.
 */
export class HerbCounterCommentOutOfDateRule extends SourceRule<HerbCounterOutOfDateAutofixContext> {
  static ruleName = "herb-counter-comment-out-of-date"
  static introducedIn = this.version("0.10.0")
  static autocorrectable = true

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
    }
  }

  check(_source: string, context?: Partial<LintContext>): UnboundLintOffense<HerbCounterOutOfDateAutofixContext>[] {
    const drift = context?.counterDriftByRule
    if (!drift) return []

    const offenses: UnboundLintOffense<HerbCounterOutOfDateAutofixContext>[] = []

    for (const entry of drift.values()) {
      if (entry.expected === entry.actual) continue
      if (entry.actual === 0) continue // handled by herb-counter-comment-unnecessary

      const location = Location.from(entry.line, entry.column, entry.line, entry.column + entry.raw.length)
      const message = `\`herb:counter\` for \`${entry.ruleName}\` expects ${entry.expected} offense${entry.expected === 1 ? "" : "s"} but found ${entry.actual}. Update the count to ${entry.actual}.`

      offenses.push(this.createOffense(message, location, {
        node: null as any as Node,
        line: entry.line,
        raw: entry.raw,
        currentCount: entry.expected,
        desiredCount: entry.actual,
      }))
    }

    return offenses
  }

  autofix(offense: LintOffense<HerbCounterOutOfDateAutofixContext>, source: string): string | null {
    if (!offense.autofixContext) return null

    const { line, raw, currentCount, desiredCount } = offense.autofixContext
    const lines = source.split("\n")
    const idx = line - 1

    if (idx < 0 || idx >= lines.length) return null

    const original = lines[idx]

    if (!original.includes(raw)) return null

    // Rewrite the trailing integer inside the specific matched comment span.
    const rewritten = raw.replace(new RegExp(`(\\s)${currentCount}(\\s*%>)$`), `$1${desiredCount}$2`)

    if (rewritten === raw) return null

    lines[idx] = original.replace(raw, rewritten)

    return lines.join("\n")
  }
}
