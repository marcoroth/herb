import { ElementStackVisitor } from "../utils/rule-utils.js"
import { getHelpersForTag, getTagLocalName, isERBOutputNode, isHTMLOpenTagNode, PrismVisitor } from "@herb-tools/core"
import { ParserRule } from "../types.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLElementNode, ERBBlockNode, ERBContentNode, ParseResult, ParserOptions, PrismNode, Location } from "@herb-tools/core"

const FORM_HELPERS = new Set(getHelpersForTag("form").filter(helper => !helper.supported).flatMap(helper => [helper.name, ...helper.aliases]))

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

class NestedFormVisitor extends ElementStackVisitor {
  private formDepth = 0

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (getTagLocalName(node) !== "form") {
      super.visitHTMLElementNode(node)
      return
    }

    if (this.formDepth > 0) {
      this.addOffense(
        "Nested `<form>` elements are not allowed. Move the inner `<form>` outside of the enclosing `<form>`, or associate its controls using the `form` attribute.",
        this.elementLocation(node),
      )
    } else {
      const verdict = this.isRenderedInsideElement("form")

      if (verdict === "always") {
        this.addOffenseWithCallChain(
          "Nested `<form>` elements are not allowed. Every call site renders this file inside a `<form>`, so associate its controls using the `form` attribute instead.",
          this.elementLocation(node),
        )
      } else if (verdict === "mixed") {
        this.addOffenseWithCallChain(
          "Nested `<form>` elements are not allowed. At least one call site renders this file inside a `<form>`.",
          this.elementLocation(node),
          this.renderedChainInside("form"),
        )
      }
    }

    this.formDepth++
    super.visitHTMLElementNode(node)
    this.formDepth--
  }

  // TODO: remove once we support transforming all the Action View form helpers
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

  // TODO: remove once we support transforming all the Action View form helpers
  visitERBContentNode(node: ERBContentNode): void {
    const helperName = this.formHelperName(node)

    if (helperName) {
      this.checkNestedHelper(helperName, node.location)
    }

    super.visitERBContentNode(node)
  }

  private checkNestedHelper(helperName: string, location: Location): void {
    if (this.formDepth > 0) {
      this.addOffense(
        `\`${helperName}\` renders its own \`<form>\` element and cannot be nested inside another \`<form>\`. Move it outside of the enclosing \`<form>\`.`,
        location,
      )

      return
    }

    const verdict = this.isRenderedInsideElement("form")

    if (verdict === "always") {
      this.addOffenseWithCallChain(
        `\`${helperName}\` renders its own \`<form>\` element and cannot be nested inside another \`<form>\`. Every call site renders this file inside a \`<form>\`.`,
        location,
      )
    } else if (verdict === "mixed") {
      this.addOffenseWithCallChain(
        `\`${helperName}\` renders its own \`<form>\` element and cannot be nested inside another \`<form>\`. At least one call site renders this file inside a \`<form>\`.`,
        location,
        this.renderedChainInside("form"),
      )
    }
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
      severity: "error",
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
