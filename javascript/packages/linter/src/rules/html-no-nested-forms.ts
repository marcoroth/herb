import { BaseRuleVisitor } from "./rule-utils.js"
import { getHelpersForTag, getTagLocalName, isERBOutputNode, isHTMLOpenTagNode, PrismVisitor } from "@herb-tools/core"
import { ParserRule } from "../types.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLElementNode, ERBBlockNode, ERBContentNode, ParseResult, ParserOptions, PrismNode, Location } from "@herb-tools/core"

// Supported helpers are transformed into `<form>` elements by the parser and
// caught by the element branch, so only unsupported ones need Prism detection.
const FORM_HELPERS = new Set(
  getHelpersForTag("form")
    .filter(helper => !helper.supported)
    .flatMap(helper => [helper.name, ...helper.aliases])
)

class FormHelperCallCollector extends PrismVisitor {
  public helperName: string | null = null

  visitCallNode(node: PrismNode): void {
    if (this.helperName) return

    if (!node.receiver && FORM_HELPERS.has(node.name)) {
      this.helperName = node.name
      return
    }

    this.visitChildNodes(node)
  }
}

class NestedFormVisitor extends BaseRuleVisitor {
  private formDepth = 0

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (getTagLocalName(node) !== "form") {
      super.visitHTMLElementNode(node)
      return
    }

    if (this.formDepth > 0) {
      this.addOffense(
        "Nested `<form>` elements are not allowed. Move the inner `<form>` outside of the enclosing form, or associate its controls using the `form` attribute.",
        this.elementLocation(node),
      )
    }

    this.formDepth++
    super.visitHTMLElementNode(node)
    this.formDepth--
  }

  visitERBBlockNode(node: ERBBlockNode): void {
    const helperName = this.formHelperName(node)

    if (!helperName) {
      super.visitERBBlockNode(node)
      return
    }

    this.checkNestedHelper(helperName, node.location)

    this.formDepth++
    super.visitERBBlockNode(node)
    this.formDepth--
  }

  visitERBContentNode(node: ERBContentNode): void {
    const helperName = this.formHelperName(node)

    if (helperName) {
      this.checkNestedHelper(helperName, node.location)
    }

    super.visitERBContentNode(node)
  }

  private checkNestedHelper(helperName: string, location: Location): void {
    if (this.formDepth === 0) return

    this.addOffense(
      `\`${helperName}\` renders its own \`<form>\` element and cannot be nested inside another form. Move it outside of the enclosing form.`,
      location,
    )
  }

  private formHelperName(node: ERBBlockNode | ERBContentNode): string | null {
    if (!isERBOutputNode(node)) return null

    const prismNode = node.prismNode
    if (!prismNode) return null

    const collector = new FormHelperCallCollector()
    collector.visit(prismNode)

    return collector.helperName
  }

  private elementLocation(node: HTMLElementNode): Location {
    if (isHTMLOpenTagNode(node.open_tag) && node.open_tag.tag_name) {
      return node.open_tag.tag_name.location
    }

    return node.location
  }
}

export class HTMLNoNestedFormsRule extends ParserRule {
  static ruleName = "html-no-nested-forms"
  static introducedIn = this.version("unreleased")

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

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NestedFormVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
