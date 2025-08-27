import { ParserRule, AttributeVisitorMixin } from "@herb-tools/linter"

import type { StaticAttributeStaticValueParams, StaticAttributeDynamicValueParams } from "@herb-tools/linter"
import type { LintOffense, StimulusLintContext } from "../types.js"
import type { ParseResult, HTMLAttributeNode } from "@herb-tools/core"

export class AttributeFormatVisitor extends AttributeVisitorMixin {
  checkStaticAttributeStaticValue({ originalAttributeName, attributeNode }: StaticAttributeStaticValueParams) {
    this.checkStimulusAttributeFormat(originalAttributeName, attributeNode)
  }

  checkStaticAttributeDynamicValue({ originalAttributeName, attributeNode }: StaticAttributeDynamicValueParams) {
    this.checkStimulusAttributeFormat(originalAttributeName, attributeNode)
  }

  private checkStimulusAttributeFormat(attributeName: string, attributeNode: HTMLAttributeNode): void {
    const targetMatch = attributeName.match(/^data-(.+?)-(.+?)-target$/)

    if (targetMatch) {
      const [, controllerName, targetName] = targetMatch
      this.checkNameFormat(controllerName, "controller identifier", attributeNode)
      this.checkNameFormat(targetName, "target name", attributeNode)
      return
    }

    const valueMatch = attributeName.match(/^data-(.+?)-(.+?)-value$/)

    if (valueMatch) {
      const [, controllerName, valueName] = valueMatch
      this.checkNameFormat(controllerName, "controller identifier", attributeNode)
      this.checkNameFormat(valueName, "value name", attributeNode)
      return
    }

    const classMatch = attributeName.match(/^data-(.+?)-(.+?)-class$/)

    if (classMatch) {
      const [, controllerName, className] = classMatch
      this.checkNameFormat(controllerName, "controller identifier", attributeNode)
      this.checkNameFormat(className, "class name", attributeNode)
      return
    }

    const outletMatch = attributeName.match(/^data-(.+?)-(.+?)-outlet$/)

    if (outletMatch) {
      const [, controllerName, outletName] = outletMatch
      this.checkNameFormat(controllerName, "controller identifier", attributeNode)
      this.checkNameFormat(outletName, "outlet name", attributeNode)
      return
    }

    if (attributeName.startsWith("data-") && this.hasCamelCase(attributeName)) {
      const dasherized = this.dasherize(attributeName)

      this.addOffense(
        `Attribute \`${attributeName}\` should use dasherized format. Did you mean \`${dasherized}\`?`,
        attributeNode.location,
        "error"
      )
    }
  }

  private checkNameFormat(name: string, type: string, attributeNode: HTMLAttributeNode): void {
    if (this.hasCamelCase(name)) {
      const dasherized = this.dasherize(name)
      this.addOffense(
        `The \`${type}\` \`${name}\` should be dasherized. Did you mean \`${dasherized}\`?`,
        attributeNode.location,
        "error"
      )
    }
  }

  private hasCamelCase(str: string): boolean {
    return /[A-Z]/.test(str)
  }

  private dasherize(str: string): string {
    return str.replace(/[A-Z]/g, (match, offset) => {
      return (offset > 0 ? "-" : "") + match.toLowerCase()
    })
  }
}

export class StimulusAttributeFormatRule extends ParserRule {
  name = "stimulus-attribute-format"

  isEnabled(): boolean {
    return true
  }

  check(result: ParseResult, context?: Partial<StimulusLintContext>): LintOffense[] {
    const visitor = new AttributeFormatVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
