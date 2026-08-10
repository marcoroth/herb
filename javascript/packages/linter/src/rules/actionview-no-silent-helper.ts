import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

import { isERBOutputNode, isPrismNodeType } from "@herb-tools/core"
import { isActionViewHelperCall } from "./action-view-utils.js"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig, BaseAutofixContext, Mutable } from "../types.js"
import type { ParseResult, ERBContentNode, ParserOptions, PrismNode } from "@herb-tools/core"

interface ActionViewNoSilentHelperAutofixContext extends BaseAutofixContext {
  node: Mutable<ERBContentNode>
}

function collectDiscardedHelperCalls(prismNode: PrismNode): { helperName: string }[] {
  const matches: { helperName: string }[] = []

  const collect = (node: PrismNode | null | undefined): void => {
    if (!node) return

    const match = isActionViewHelperCall(node)

    if (match) {
      matches.push(match)
      return
    }

    if (isPrismNodeType(node, "StatementsNode")) {
      node.body.forEach(collect)
      return
    }

    if (isPrismNodeType(node, "IfNode")) {
      collect(node.statements)
      collect(node.subsequent)
      return
    }

    if (isPrismNodeType(node, "UnlessNode")) {
      collect(node.statements)
      collect(node.elseClause)
      return
    }

    if (isPrismNodeType(node, "ElseNode")) {
      collect(node.statements)
      return
    }

    if (isPrismNodeType(node, "AndNode") || isPrismNodeType(node, "OrNode")) {
      collect(node.right)
      return
    }

    if (isPrismNodeType(node, "BeginNode")) {
      collect(node.statements)
      return
    }

    if (isPrismNodeType(node, "ParenthesesNode")) {
      collect(node.body)
      return
    }
  }

  collect(prismNode)

  return matches
}

class ActionViewNoSilentHelperVisitor extends BaseRuleVisitor<ActionViewNoSilentHelperAutofixContext> {
  visitERBContentNode(node: ERBContentNode): void {
    this.checkSilentHelper(node)
    super.visitERBContentNode(node)
  }

  private checkSilentHelper(node: ERBContentNode): void {
    if (isERBOutputNode(node)) return

    const tagOpening = node.tag_opening?.value
    if (!tagOpening) return
    if (tagOpening.startsWith("<%%")) return

    const prismNode = node.prismNode
    if (!prismNode) return

    for (const match of collectDiscardedHelperCalls(prismNode)) {
      this.addOffense(
        `Avoid using \`${tagOpening} %>\` with \`${match.helperName}\`. Use \`<%= %>\` to ensure the helper's output is rendered.`,
        node.location,
        { node: node as Mutable<ERBContentNode> },
      )
    }
  }
}

export class ActionViewNoSilentHelperRule extends ParserRule<ActionViewNoSilentHelperAutofixContext> {
  static unsafeAutocorrectable = true
  static autofixRequiresContext = true
  static ruleName = "actionview-no-silent-helper"
  static introducedIn = this.version("0.9.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
      prism_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<ActionViewNoSilentHelperAutofixContext>[] {
    const visitor = new ActionViewNoSilentHelperVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<ActionViewNoSilentHelperAutofixContext>, result: ParseResult): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node } = offense.autofixContext

    if (!node.tag_opening) return null
    if (node.tag_opening.value === "<%=") return null

    node.tag_opening.value = "<%="

    return result
  }
}
