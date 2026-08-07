import { hasAttribute, PrismVisitor, getHelpersByModule, helperExists } from "@herb-tools/core"

import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"

import type { HTMLOpenTagNode, ParseResult, ERBContentNode, ParserOptions, PrismNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

const FORM_TAG_HELPERS = new Set(
  getHelpersByModule("FormTagHelper")
    .filter(h => h.tagName === "input" || h.tagName === "textarea" || h.tagName === "select")
    .flatMap(h => [h.name, ...h.aliases])
)

const FORM_BUILDER_METHODS = new Set([
  "text_area",
  "text_field",
  "textarea",
])

class AutofocusKeywordDetector extends PrismVisitor {
  public hasAutofocus = false
  private isInsideFormHelper = false

  visitCallNode(node: PrismNode): void {
    const isBuilderMethod = node.receiver && FORM_BUILDER_METHODS.has(node.name)
    const isTagHelper = !node.receiver && FORM_TAG_HELPERS.has(node.name)

    if (isBuilderMethod || isTagHelper) {
      this.isInsideFormHelper = true
      this.visitChildNodes(node)
      this.isInsideFormHelper = false
    } else {
      this.visitChildNodes(node)
    }
  }

  visitAssocNode(node: PrismNode): void {
    if (!this.isInsideFormHelper) return
    if (node.key?.constructor?.name !== "SymbolNode") return

    this.hasAutofocus = node.key.unescaped?.value === "autofocus"
  }
}

class NoAutofocusAttributeVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkAutofocusAttribute(node)

    super.visitHTMLOpenTagNode(node)
  }

  visitERBContentNode(node: ERBContentNode): void {
    this.checkERBHelper(node)

    super.visitERBContentNode(node)
  }

  private checkAutofocusAttribute(node: HTMLOpenTagNode): void {
    if (!hasAttribute(node, "autofocus")) return

    this.addOffense(
      "Avoid using the `autofocus` attribute. It reduces accessibility by moving users to an element without warning and context.",
      node.tag_name!.location,
    )
  }

  private checkERBHelper(node: ERBContentNode): void {
    const prismNode = node.prismNode
    if (!prismNode) return

    const detector = new AutofocusKeywordDetector()
    detector.visit(prismNode)
    if (!detector.hasAutofocus) return;

    this.addOffense(
      "Avoid using the `autofocus` option in form helpers. It reduces accessibility by moving users to an element without warning and context.",
      node.location,
    )
  }
}

export class A11yNoAutofocusAttributeRule extends ParserRule {
  static ruleName = "a11y-no-autofocus-attribute"
  static introducedIn = this.version("0.9.3")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "warning"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoAutofocusAttributeVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
