import { StimulusRuleVisitor, HerbParserRule, getAttributeName, getAttributeValue, getStaticAttributeValue, hasStaticAttributeValue } from "./rule-utils.js"

import type { LintOffense, StimulusLintContext } from "../types.js"
import type { ParseResult, HTMLAttributeNode } from "@herb-tools/core"

class DataControllerValidVisitor extends StimulusRuleVisitor {
  visitHTMLAttributeNode(node: HTMLAttributeNode): void {
    const name = getAttributeName(node)

    if (name !== "data-controller") return
    const controllerAttribute = getAttributeValue(node)

    if (!controllerAttribute) return
    if (!hasStaticAttributeValue(node)) return

    const value = getStaticAttributeValue(node)
    if (!value) return

    this.validateStaticControllers(value, node)
  }

  private validateStaticControllers(value: string, attributeNode: HTMLAttributeNode): void {
    const controllers = this.getControllerIdentifiers(value)

    for (const controller of controllers) {
      this.validateControllerIdentifier(controller, attributeNode.value?.location || attributeNode.location)
    }
  }
}

export class StimulusDataControllerValidRule extends HerbParserRule {
  name = "stimulus-data-controller-valid"

  check(result: ParseResult, context?: Partial<StimulusLintContext>): LintOffense[] {
    const visitor = new DataControllerValidVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
