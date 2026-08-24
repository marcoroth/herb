import { SourceRule } from "../types.js"
import { Location } from "@herb-tools/core"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig, BaseAutofixContext } from "../types.js"
import type { Node } from "@herb-tools/core"

interface HerbDisableCommentOutOfDateAutofixContext extends BaseAutofixContext {
  line: number
  raw: string
  countOffset: number
  countLength: number
  desiredCount: number
}

/**
 * Report every file-scoped `<%# herb:disable RULE N %>` entry whose declared
 * count (N) does not match the actual number of offenses (E) for that rule in
 * the file, after herb:disable line-scope filtering.
 *
 * - When N > E: the linter still reports every actual offense (intentional
 *   divergence from erb_lint) *and* emits this rule on the comment so the
 *   developer sees both the drift and the offending code.
 * - When 0 < N < E: the actual offenses are suppressed (they still ratchet),
 *   and this rule fires so the developer can rewrite N to E.
 * - When N > 0 but E == 0: the entry is unnecessary; autofix drops the count
 *   (autofix implementation in `--update-disable-counts`).
 *
 * `all` entries are not tracked here — they intentionally waive drift reporting.
 *
 * The per-rule drift map is built in `Linter#lint` and delivered via
 * `context.counterDriftByRule`.
 */
export class HerbDisableCommentOutOfDateRule extends SourceRule<HerbDisableCommentOutOfDateAutofixContext> {
  static ruleName = "herb-disable-comment-out-of-date"
  static introducedIn = this.version("unreleased")
  static autocorrectable = true

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
    }
  }

  check(_source: string, context?: Partial<LintContext>): UnboundLintOffense<HerbDisableCommentOutOfDateAutofixContext>[] {
    const drift = context?.counterDriftByRule
    if (!drift) return []

    const offenses: UnboundLintOffense<HerbDisableCommentOutOfDateAutofixContext>[] = []

    for (const entry of drift.values()) {
      if (entry.expected === entry.actual) continue

      const location = Location.from(entry.line, entry.column, entry.line, entry.column + entry.raw.length)

      const message = entry.actual === 0
        ? `\`herb:disable\` entry for \`${entry.ruleName}\` expects ${entry.expected} offense${entry.expected === 1 ? "" : "s"} but the file has none. Remove the count (or the entry).`
        : `\`herb:disable\` entry for \`${entry.ruleName}\` expects ${entry.expected} offense${entry.expected === 1 ? "" : "s"} but found ${entry.actual}. Update the count to ${entry.actual}.`

      offenses.push(this.createOffense(message, location, {
        node: null as any as Node,
        line: entry.line,
        raw: entry.raw,
        countOffset: entry.countOffset,
        countLength: entry.countLength,
        desiredCount: entry.actual,
      }))
    }

    return offenses
  }

  autofix(offense: LintOffense<HerbDisableCommentOutOfDateAutofixContext>, source: string): string | null {
    if (!offense.autofixContext) return null

    const { line, raw, countOffset, countLength, desiredCount } = offense.autofixContext
    const lines = source.split("\n")
    const idx = line - 1

    if (idx < 0 || idx >= lines.length) return null

    const original = lines[idx]

    if (!original.includes(raw)) return null

    // Replace the count token in place within the matched comment span.
    const before = raw.slice(0, countOffset)
    const after = raw.slice(countOffset + countLength)
    const rewritten = `${before}${desiredCount}${after}`

    if (rewritten === raw) return null

    lines[idx] = original.replace(raw, rewritten)

    return lines.join("\n")
  }
}
