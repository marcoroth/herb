import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"

import { isPrismNodeType, isRubyRenderLocalNode } from "@herb-tools/core"

import type { ERBRenderNode, ParseResult, ParserOptions, PartialDeclaration, PrismNode, PrismNodes, RubyRenderLocalNode } from "@herb-tools/core"
import type { FullRuleConfig, LintContext, UnboundLintOffense } from "../types.js"

const LOCALS_KEYWORD = "locals"

class ActionViewNoStrictLocalsErrorVisitor extends BaseRuleVisitor {
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
    if (keywords.collection || keywords.object) return
    if (this.forwardsUnknownLocals(node)) return

    const declaration = partials.lookup(partialName, this.context.fileName)

    if (!declaration) return
    if (!declaration.hasDeclaration) return

    this.checkMissingLocals(node, declaration, partialName)
    this.checkUndeclaredLocals(node, declaration, partialName)
  }

  private checkMissingLocals(node: ERBRenderNode, declaration: PartialDeclaration, partialName: string): void {
    const provided = this.providedLocalNames(node)
    const missing = declaration.locals.filter(local => local.required && !provided.has(local.name))

    if (missing.length === 0) return

    const names = missing.map(local => `\`${local.name}:\``)

    this.addOffense(
      `The partial \`${partialName}\` requires the ${this.list(names)} local${missing.length === 1 ? "" : "s"} to be passed. Rails raises an \`ActionView::StrictLocalsError\` when a required local is missing, so add ${missing.length === 1 ? "it" : "them"} to this \`render\` call.`,
      node.keywords!.partial!.location,
    )
  }

  private checkUndeclaredLocals(node: ERBRenderNode, declaration: PartialDeclaration, partialName: string): void {
    if (declaration.hasKeywordRest) return

    const declared = new Set(declaration.locals.map(local => local.name))

    for (const local of this.providedLocals(node)) {
      const name = local.name!.value

      if (declared.has(name)) continue

      this.addOffense(
        `The partial \`${partialName}\` does not declare the \`${name}:\` local. Rails raises an \`ActionView::StrictLocalsError\` when a caller passes an undeclared local, so remove it from this \`render\` call, or add it to the partial's \`<%# locals: () %>\` declaration.`,
        local.name!.location,
      )
    }
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

  private providedLocalNames(node: ERBRenderNode): Set<string> {
    return new Set(this.providedLocals(node).map(local => local.name!.value))
  }

  private forwardsUnknownLocals(node: ERBRenderNode): boolean {
    const call = node.prismNode

    if (!isPrismNodeType(call, "CallNode")) return true

    let forwards = false

    const walk = (current: PrismNode | null | undefined): void => {
      if (!current || forwards) return

      if (isPrismNodeType(current, "AssocSplatNode")) {
        forwards = true

        return
      }

      if (isPrismNodeType(current, "AssocNode") && this.isOpaqueLocalsAssoc(current)) {
        forwards = true

        return
      }

      for (const child of current.childNodes?.() ?? []) walk(child as PrismNode)
    }

    walk(call)

    return forwards
  }

  private isOpaqueLocalsAssoc(node: PrismNodes.AssocNode): boolean {
    if (!isPrismNodeType(node.key, "SymbolNode")) return false
    if (node.key.unescaped?.value !== LOCALS_KEYWORD) return false

    return !isPrismNodeType(node.value, "HashNode")
  }

  private list(names: string[]): string {
    if (names.length === 1) return names[0]
    if (names.length === 2) return `${names[0]} and ${names[1]}`

    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
  }
}

export class ActionViewNoStrictLocalsErrorRule extends ParserRule {
  static ruleName = "actionview-no-strict-locals-error"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      render_nodes: true,
      prism_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    if (!context?.partials) return []

    const visitor = new ActionViewNoStrictLocalsErrorVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
