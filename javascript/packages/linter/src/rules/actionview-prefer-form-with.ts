import { ParserRule } from "../types.js"
import { PrismVisitor, findPreferredHelperForTag, getHelperBySource, locationFromByteOffset } from "@herb-tools/core"

import type { ParseResult, ParserOptions, PrismNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

const LEGACY_FORM_HELPER = getHelperBySource("ActionView::Helpers::FormHelper#form_for")
const PREFERRED_FORM_HELPER = findPreferredHelperForTag("form")

const LEGACY_FORM_HELPER_NAMES = new Set(
  LEGACY_FORM_HELPER && !LEGACY_FORM_HELPER.preferredForTag ? [LEGACY_FORM_HELPER.name, ...LEGACY_FORM_HELPER.aliases] : [],
)

class LegacyFormHelperCallCollector extends PrismVisitor {
  public readonly calls: PrismNode[] = []

  visitCallNode(node: PrismNode): void {
    if (!node.receiver && LEGACY_FORM_HELPER_NAMES.has(node.name)) {
      this.calls.push(node)
    }

    this.visitChildNodes(node)
  }
}

export class ActionViewPreferFormWithRule extends ParserRule {
  static ruleName = "actionview-prefer-form-with"
  static introducedIn = this.version("0.11.0")
  static defaultEnabledIn = this.version("0.11.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "info",
      frameworks: ["actionview"],
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_program: true,
    }
  }

  check(result: ParseResult, _context?: Partial<LintContext>): UnboundLintOffense[] {
    if (!PREFERRED_FORM_HELPER) return []

    const source = result.value.source
    const prismNode = result.value.prismNode

    if (!prismNode || !source) return []

    const collector = new LegacyFormHelperCallCollector()
    collector.visit(prismNode)

    return collector.calls.map(call => {
      const { startOffset, length } = call.messageLoc ?? call.location

      return this.createOffense(
        `Prefer the \`${PREFERRED_FORM_HELPER.name}\` helper over \`${call.name}\`, which the Rails guides no longer document and describe as discouraged. Pass the record to \`${PREFERRED_FORM_HELPER.name}\` as \`model:\`, and move an \`as:\` option to \`scope:\` and \`html:\` options to the top level.`,
        locationFromByteOffset(source, startOffset, length),
      )
    })
  }
}
