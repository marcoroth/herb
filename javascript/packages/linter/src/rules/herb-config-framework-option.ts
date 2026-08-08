import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import { Location, PrismVisitor, getHelper, locationFromByteOffset } from "@herb-tools/core"

import type { ERBStrictLocalsNode, ParseResult, ParserOptions, PrismNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

export const AMBIGUOUS_HELPERS = new Set([
  "button",
  "cache",
  "caching?",
  "capture",
  "checkbox",
  "concat",
  "controller",
  "cookies",
  "cycle",
  "debug",
  "excerpt",
  "fields",
  "flash",
  "headers",
  "highlight",
  "j",
  "l",
  "label",
  "localize",
  "logger",
  "logger?",
  "multipart",
  "object",
  "params",
  "pluralize",
  "provide",
  "raw",
  "render",
  "request",
  "response",
  "sanitize",
  "select",
  "session",
  "submit",
  "t",
  "tag",
  "textarea",
  "translate",
  "truncate",
  "uncacheable!"
])

const MISSING_OPTION = "No `framework` is set in `.herb.yml`, so Herb assumes plain `ruby` templates."
const SET_ACTION_VIEW = "Set `framework: actionview` to get the rules, assumptions, and optimizations that come with it."
const SET_ANY_FRAMEWORK = "Set `framework` to one of `ruby`, `actionview`, `hanami`, or `sinatra` so Herb can tailor its assumptions, rules, and optimizations to your framework."

function isActionViewHelperCall(node: PrismNode): boolean {
  if (node.receiver) return false
  if (AMBIGUOUS_HELPERS.has(node.name)) return false

  return getHelper(node.name) !== undefined
}

class HelperCallCollector extends PrismVisitor {
  public helperCall: PrismNode | null = null

  visitCallNode(node: PrismNode): void {
    if (!this.helperCall && isActionViewHelperCall(node)) {
      this.helperCall = node
    }

    this.visitChildNodes(node)
  }
}

class StrictLocalsCollector extends BaseRuleVisitor {
  public declaration: ERBStrictLocalsNode | null = null

  visitERBStrictLocalsNode(node: ERBStrictLocalsNode): void {
    this.declaration ||= node
  }
}

export class HerbConfigFrameworkOptionRule extends ParserRule {
  static ruleName = "herb-config-framework-option"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "hint",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      strict_locals: true,
      prism_program: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    if (context?.frameworkConfigured) return []

    const strictLocals = new StrictLocalsCollector(this.ruleName, context)

    strictLocals.visit(result.value)

    if (strictLocals.declaration) {
      return [
        this.createOffense(
          `${MISSING_OPTION} This template declares strict locals, which only Action View reads, so this project looks like \`actionview\`. ${SET_ACTION_VIEW}`,
          strictLocals.declaration.location,
        )
      ]
    }

    const helperCall = this.findHelperCall(result)

    if (helperCall) {
      const source = result.value.source!
      const { startOffset, length } = helperCall.location

      return [
        this.createOffense(
          `${MISSING_OPTION} \`${helperCall.name}\` is an Action View helper, so this project looks like \`actionview\`. ${SET_ACTION_VIEW}`,
          locationFromByteOffset(source, startOffset, length),
        )
      ]
    }

    return [
      this.createOffense(`${MISSING_OPTION} ${SET_ANY_FRAMEWORK}`, Location.from(1, 0, 1, 0))
    ]
  }

  private findHelperCall(result: ParseResult): PrismNode | null {
    const prismNode = result.value.prismNode
    if (!prismNode || !result.value.source) return null

    const collector = new HelperCallCollector()

    collector.visit(prismNode)

    return collector.helperCall
  }

}
