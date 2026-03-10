import { StimulusRuleVisitor, HerbParserRule, didyoumean, getAttribute, getStaticAttributeValue, hasStaticAttributeValue, parseActionDescriptor } from "./rule-utils.js"

import type { LintOffense, StimulusLintContext } from "../types.js"
import type { ParseResult, HTMLOpenTagNode, HTMLAttributeNode } from "@herb-tools/core"

class DataActionValidVisitor extends StimulusRuleVisitor {
  // TODO: use visitHTMLAttributeNode
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkDataAction(node)
    super.visitHTMLOpenTagNode(node)
  }

  private checkDataAction(node: HTMLOpenTagNode): void {
    const actionAttribute = getAttribute(node, "data-action")

    if (!actionAttribute) return
    if (!hasStaticAttributeValue(actionAttribute)) return

    const value = getStaticAttributeValue(actionAttribute)
    if (!value) return

    this.validateStaticActions(value, actionAttribute)
  }

  private validateStaticActions(value: string, attributeNode: HTMLAttributeNode): void {
    const actions = value.trim().split(/\s+/).filter(action => action.length > 0)

    for (const action of actions) {
      const descriptor = parseActionDescriptor(action)

      if (!descriptor.valid || !descriptor.identifier || !descriptor.methodName) {
        this.addOffense(`Invalid action descriptor \`${action}\`. Expected format: \`[event->]controller#action\``, attributeNode.location, "error")
        continue
      }

      if (!this.isControllerAvailable(descriptor.identifier)) {
        this.addOffense(`Unknown Stimulus controller \`${descriptor.identifier}\` in action \`${action}\`. Make sure the controller is defined in your project.`, attributeNode.location, "error")
        continue
      }

      if (this.stimulusProject) {
        const controller = this.stimulusProject.registeredControllers.find(controller => controller.identifier === descriptor.identifier)

        if (controller && controller.controllerDefinition.actionNames && !controller.controllerDefinition.actionNames.includes(descriptor.methodName)) {
          const suggestion = didyoumean(descriptor.methodName, controller.controllerDefinition.actionNames)
          this.addOffense(`Unknown action method \`${descriptor.methodName}\` on controller "${descriptor.identifier}".${suggestion}`, attributeNode.location, "error")
        }
      }
    }
  }

}

export class StimulusDataActionValidRule extends HerbParserRule {
  name = "stimulus-data-action-valid"

  check(result: ParseResult, context?: Partial<StimulusLintContext>): LintOffense[] {
    const visitor = new DataActionValidVisitor(this.name, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
