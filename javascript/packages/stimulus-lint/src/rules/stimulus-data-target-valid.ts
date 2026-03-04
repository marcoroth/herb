import { StimulusRuleVisitor, HerbParserRule } from "./rule-utils.js"
import { getStaticAttributeValue, hasStaticAttributeValue, getAttributeName, getTokenList, didyoumean } from "@herb-tools/core"

import type { UnboundLintOffense, StimulusLintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLAttributeNode } from "@herb-tools/core"

class DataTargetValidVisitor extends StimulusRuleVisitor {
  visitHTMLAttributeNode(node: HTMLAttributeNode): void {
    const name = getAttributeName(node)
    if (!name) return

    const targetMatch = name.match(/^data-(.+)-target$/)
    if (!targetMatch) return

    const identifier = targetMatch[1]

    if (hasStaticAttributeValue(node)) {
      const value = getStaticAttributeValue(node)

      if (value) {
        this.validateStaticTargets(identifier, value, node)
      }
    }
  }

  private validateStaticTargets(identifier: string, value: string, attributeNode: HTMLAttributeNode): void {
    if (this.validateControllerIdentifier(identifier, attributeNode.location)) {
      return
    }

    const targetNames = getTokenList(value)

    for (const targetName of targetNames) {
      if (this.stimulusProject) {
        const controller = this.stimulusProject.registeredControllers.find(controller => controller.identifier === identifier)

        if (controller && controller.controllerDefinition.targetNames && !controller.controllerDefinition.targetNames.includes(targetName)) {
          const match = didyoumean(targetName, controller.controllerDefinition.targetNames, 2)
          const suggestion = match ? ` Did you mean \`${match}\`?` : ""
          this.addOffense(`Unknown target \`${targetName}\` on controller \`${identifier}\`.${suggestion}`, attributeNode.location)
        }
      }
    }
  }
}

export class StimulusDataTargetValidRule extends HerbParserRule {
  static ruleName = "stimulus-data-target-valid"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<StimulusLintContext>): UnboundLintOffense[] {
    const visitor = new DataTargetValidVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
