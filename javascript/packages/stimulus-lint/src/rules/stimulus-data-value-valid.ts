import {
  StimulusRuleVisitor,
  HerbParserRule,
  didyoumean,
  forEachAttribute,
  getAttributeName,
  getStaticAttributeValue,
  hasStaticAttributeValue
} from './rule-utils.js'

import type { LintOffense, StimulusLintContext } from '../types.js'
import type { ParseResult, HTMLOpenTagNode, HTMLAttributeNode } from '@herb-tools/core'

export class DataValueValidVisitor extends StimulusRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkDataValues(node)
    super.visitHTMLOpenTagNode(node)
  }

  private checkDataValues(node: HTMLOpenTagNode): void {
    forEachAttribute(node, (attribute) => {
      const name = getAttributeName(attribute)
      if (!name) return

      const valueMatch = name.match(/^data-(.+?)-(.+?)-value$/)
      if (!valueMatch) return

      const [, identifier, valueName] = valueMatch

      if (hasStaticAttributeValue(attribute)) {
        const value = getStaticAttributeValue(attribute)

        this.validateStaticValue(identifier, valueName, value, attribute)
      }
    })
  }

  private validateStaticValue(identifier: string, valueName: string, value: string | null, attributeNode: HTMLAttributeNode): void {
    if (!this.isControllerAvailable(identifier)) {
      this.addOffense(
        `Unknown Stimulus controller \`${identifier}\` in value attribute. Make sure the controller is defined in your project.`,
        attributeNode.location,
        'error'
      )
      return
    }

    if (/[A-Z]/.test(valueName)) {
      const dasherized = valueName.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)

      this.addOffense(
        `Value name \`${valueName}\` should be dasherized. Did you mean \`${dasherized}\`?`,
        attributeNode.location,
        'error'
      )

      return
    }

    if (this.stimulusProject) {
      const controller = this.stimulusProject.registeredControllers.find(controller => controller.identifier === identifier)

      if (controller && controller.controllerDefinition.values) {
        const valueDefinition = controller.controllerDefinition.values.find(value => value.name === valueName)

        if (!valueDefinition) {
          const suggestion = didyoumean(valueName, controller.controllerDefinition.values.map((v: any) => v.name))

          this.addOffense(
            `Unknown value \`${valueName}\` on controller \`${identifier}\`.${suggestion}`,
            attributeNode.location,
            'error'
          )
          return
        }

        if (value !== null && valueDefinition.type) {
          this.validateValueType(identifier, valueName, value, valueDefinition.type, attributeNode)
        }
      }
    }
  }

  private validateValueType(
    identifier: string,
    valueName: string,
    value: string,
    expectedType: string,
    attributeNode: HTMLAttributeNode
  ): void {
    let actualType: string | null = null

    try {
      const parsedValue = JSON.parse(value)

      if (Array.isArray(parsedValue)) {
        actualType = 'Array'
      } else if (typeof parsedValue === 'boolean') {
        actualType = 'Boolean'
      } else if (typeof parsedValue === 'number') {
        actualType = 'Number'
      } else if (typeof parsedValue === 'object' && parsedValue !== null) {
        actualType = 'Object'
      } else if (typeof parsedValue === 'string') {
        actualType = 'String'
      }
    } catch {
      actualType = 'String'
    }

    if (actualType && actualType !== expectedType) {
      this.addOffense(
        `Value \`${valueName}\` on controller \`${identifier}\` expects type \`${expectedType}\` but received \`${actualType}\`.`,
        attributeNode.location,
        'error'
      )
    }
  }
}

export class StimulusDataValueValidRule extends HerbParserRule {
  name = 'stimulus-data-value-valid'

  check(result: ParseResult, context?: Partial<StimulusLintContext>): LintOffense[] {
    const visitor = new DataValueValidVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
