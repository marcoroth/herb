import { StimulusRuleVisitor, HerbParserRule, didyoumean, getStaticAttributeValue, hasStaticAttributeValue, getAttributeName } from "./rule-utils.js"

import type { LintOffense, StimulusLintContext } from "../types.js"
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

    const targetNames = value.trim().split(/\s+/).filter((name: string) => name.length > 0)

    for (const targetName of targetNames) {
      if (this.stimulusProject) {
        const controller = this.stimulusProject.registeredControllers.find(controller => controller.identifier === identifier)

        if (controller && controller.controllerDefinition.targetNames && !controller.controllerDefinition.targetNames.includes(targetName)) {
          const suggestion = didyoumean(targetName, controller.controllerDefinition.targetNames)
          this.addOffense(`Unknown target \`${targetName}\` on controller \`${identifier}\`.${suggestion}`, attributeNode.location, "error")
        }
      }
    }
  }
}

export class StimulusDataTargetValidRule extends HerbParserRule {
  name = "stimulus-data-target-valid"

  check(result: ParseResult, context?: Partial<StimulusLintContext>): LintOffense[] {
    const visitor = new DataTargetValidVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
