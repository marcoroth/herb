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

export class HerbDisableCommentOutOfDateRule extends SourceRule<HerbDisableCommentOutOfDateAutofixContext> {
  static ruleName = "herb-disable-comment-out-of-date"
  static introducedIn = this.version("0.11.0")
  static defaultEnabledIn = this.version("0.11.0")
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

      const offenseWord = entry.expected === 1 ? "offense" : "offenses"

      if (!entry.measurable) {
        offenses.push(this.createOffense(
          `\`herb:disable\` entry for \`${entry.ruleName}\` expects ${entry.expected} ${offenseWord}, but \`${entry.ruleName}\` is not enabled, so its offenses cannot be counted. Remove the entry or enable the rule.`,
          location,
        ))

        continue
      }

      const message = entry.actual === 0
        ? `\`herb:disable\` entry for \`${entry.ruleName}\` expects ${entry.expected} ${offenseWord} but the file has none. Remove the count (or the entry).`
        : `\`herb:disable\` entry for \`${entry.ruleName}\` expects ${entry.expected} ${offenseWord} but found ${entry.actual}. Update the count to ${entry.actual}.`

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
    const index = line - 1

    if (index < 0 || index >= lines.length) return null

    const original = lines[index]

    if (!original.includes(raw)) return null

    const before = raw.slice(0, countOffset)
    const after = raw.slice(countOffset + countLength)
    const rewritten = `${before}${desiredCount}${after}`

    if (rewritten === raw) return null

    lines[index] = original.replace(raw, rewritten)

    return lines.join("\n")
  }
}
