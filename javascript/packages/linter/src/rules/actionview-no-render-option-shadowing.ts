import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"

import { isPrismNodeType, isRubyRenderLocalNode } from "@herb-tools/core"

import type { ERBRenderNode, ParseResult, ParserOptions, RubyRenderLocalNode } from "@herb-tools/core"
import type { FullRuleConfig, LintContext, UnboundLintOffense } from "../types.js"

const RENDER_OPTIONS = new Set([
  "as",
  "cached",
  "collection",
  "content_type",
  "formats",
  "handlers",
  "layout",
  "object",
  "spacer_template",
  "template",
  "variants",
])

class ActionViewNoRenderOptionShadowingVisitor extends BaseRuleVisitor {
  visitERBRenderNode(node: ERBRenderNode): void {
    this.checkRender(node)

    this.visitChildNodes(node)
  }

  private checkRender(node: ERBRenderNode): void {
    if (!this.isShorthandForm(node)) return

    for (const local of node.keywords?.locals ?? []) {
      if (!isRubyRenderLocalNode(local)) continue

      this.checkLocal(local)
    }
  }

  private isShorthandForm(node: ERBRenderNode): boolean {
    const call = node.prismNode

    if (!isPrismNodeType(call, "CallNode")) return false

    const [first] = call.arguments_?.arguments_ ?? []

    if (!first) return false

    return !isPrismNodeType(first, "KeywordHashNode")
  }

  private checkLocal(local: RubyRenderLocalNode): void {
    const name = local.name?.value

    if (!name) return
    if (!RENDER_OPTIONS.has(name)) return

    this.addOffense(
      `The local \`${name}\` shadows the \`render\` option of the same name. Every keyword in the shorthand \`render "partial", ...\` form becomes a local, but the same keyword after \`render partial: "..."\` is a render option instead. Move it into an explicit \`locals: { ${name}: ... }\` hash so there is only one way to read it.`,
      local.name!.location,
    )
  }
}

export class ActionViewNoRenderOptionShadowingRule extends ParserRule {
  static ruleName = "actionview-no-render-option-shadowing"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "info",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      render_nodes: true,
      prism_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ActionViewNoRenderOptionShadowingVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
