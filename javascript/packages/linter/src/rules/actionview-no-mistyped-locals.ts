import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"
import { kindWithArticle } from "../utils/state-directives-utils.js"
import { classifyDefault } from "@herb-tools/client/directives"

import { isRubyRenderLocalNode } from "@herb-tools/core"

import type { ERBRenderNode, ParseResult, ParserOptions, RubyRenderLocalNode } from "@herb-tools/core"
import type { StrictLocal } from "@herb-tools/analysis"
import type { FullRuleConfig, LintContext, UnboundLintOffense } from "../types.js"

const CHECKED_KINDS = ["boolean", "integer", "string", "symbol"]

class ActionViewNoMistypedLocalsVisitor extends BaseRuleVisitor {
  visitERBRenderNode(node: ERBRenderNode): void {
    this.checkRender(node)

    this.visitChildNodes(node)
  }

  private checkRender(node: ERBRenderNode): void {
    const partials = this.context.partials
    if (!partials) return

    const keywords = node.keywords
    if (!keywords) return

    const partialName = keywords.partial?.value
    if (!partialName) return

    const declaration = partials.lookup(partialName, this.sourceFile)
    if (!declaration || !declaration.hasDeclaration) return

    for (const local of this.providedLocals(node)) {
      const declared = declaration.locals.find((candidate) => candidate.name === local.name!.value)
      if (!declared) continue

      this.checkLocal(local, declared, partialName)
    }
  }

  private checkLocal(local: RubyRenderLocalNode, declared: StrictLocal, partialName: string): void {
    if (!declared.defaultSource) return

    const declaredKind = classifyDefault(declared.defaultSource.trim())

    if (!CHECKED_KINDS.includes(declaredKind)) return

    const argument = local.value?.content?.trim()

    if (!argument) return

    const argumentKind = classifyDefault(argument)

    if (!CHECKED_KINDS.includes(argumentKind) && argumentKind !== "nil") return
    if (argumentKind === declaredKind || argumentKind === "nil") return

    this.addOffense(
      `\`${local.name!.value}: ${argument}\` passes ${kindWithArticle(argumentKind)} where the partial \`${partialName}\` declares ${kindWithArticle(declaredKind)} default (\`${declared.name}: ${declared.defaultSource}\`). Pass ${kindWithArticle(declaredKind)}, or change the partial's default, since its reads of \`${declared.name}\` expect one.`,
      local.name!.location,
    )
  }

  private providedLocals(node: ERBRenderNode): RubyRenderLocalNode[] {
    const locals: RubyRenderLocalNode[] = []

    for (const local of node.keywords?.locals ?? []) {
      if (!isRubyRenderLocalNode(local)) continue
      if (!local.name?.value) continue

      locals.push(local)
    }

    return locals
  }
}

export class ActionViewNoMistypedLocalsRule extends ParserRule {
  static ruleName = "actionview-no-mistyped-locals"
  static introducedIn = this.version("unreleased")

  get parserOptions(): Partial<ParserOptions> {
    return {
      render_nodes: true,
      prism_nodes: true,
    }
  }

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
      frameworks: ["actionview"]
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    if (!context?.partials) return []

    const visitor = new ActionViewNoMistypedLocalsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
