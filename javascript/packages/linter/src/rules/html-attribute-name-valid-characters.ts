import { isLiteralNode } from "@herb-tools/core"

import { ParserRule } from "../types.js"
import { IdentityPrinter } from "@herb-tools/printer"
import { AttributeVisitorMixin, StaticAttributeStaticValueParams, StaticAttributeDynamicValueParams, DynamicAttributeStaticValueParams, DynamicAttributeDynamicValueParams } from "../utils/rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLAttributeNode, Node } from "@herb-tools/core"

function isLetter(character: string): boolean {
  return (character >= "a" && character <= "z") || (character >= "A" && character <= "Z")
}

function isDigit(character: string): boolean {
  return character >= "0" && character <= "9"
}

function isNameCharacter(character: string): boolean {
  return isLetter(character) || isDigit(character) || character === "-" || character === "_"
}

function invalidCharactersIn(name: string, allowNamespaceColon: boolean): string[] {
  const invalid = new Set<string>()
  const namespaceColonIndex = name.indexOf(":")

  for (let index = 0; index < name.length; index++) {
    const character = name[index]

    if (isNameCharacter(character)) continue

    if (character === ":" && allowNamespaceColon && index === namespaceColonIndex && index > 0 && index < name.length - 1) {
      continue
    }

    invalid.add(character)
  }

  return [...invalid]
}

function formatCharacterList(characters: string[]): string {
  const quoted = characters.map(character => `\`${character}\``)

  if (quoted.length === 1) return quoted[0]

  return `${quoted.slice(0, -1).join(", ")} and ${quoted[quoted.length - 1]}`
}

class HTMLAttributeNameValidCharactersVisitor extends AttributeVisitorMixin {
  protected checkStaticAttributeStaticValue({ originalAttributeName, attributeNode }: StaticAttributeStaticValueParams): void {
    this.checkStaticName(originalAttributeName, attributeNode)
  }

  protected checkStaticAttributeDynamicValue({ originalAttributeName, attributeNode }: StaticAttributeDynamicValueParams): void {
    this.checkStaticName(originalAttributeName, attributeNode)
  }

  protected checkDynamicAttributeStaticValue({ nameNodes, attributeNode }: DynamicAttributeStaticValueParams): void {
    this.checkDynamicName(nameNodes, attributeNode)
  }

  protected checkDynamicAttributeDynamicValue({ nameNodes, attributeNode }: DynamicAttributeDynamicValueParams): void {
    this.checkDynamicName(nameNodes, attributeNode)
  }

  private checkStaticName(name: string, attributeNode: HTMLAttributeNode): void {
    if (name.length === 0) return

    const invalidCharacters = invalidCharactersIn(name, true)

    if (invalidCharacters.length > 0) {
      this.reportInvalidCharacters(name, invalidCharacters, attributeNode)

      return
    }

    if (!isLetter(name[0]) && name[0] !== "_") {
      this.addOffense(
        `Attribute name \`${name}\` must start with a letter.`,
        attributeNode.name?.location ?? attributeNode.location,
      )
    }
  }

  private checkDynamicName(nameNodes: Node[], attributeNode: HTMLAttributeNode): void {
    const invalidCharacters = new Set<string>()

    for (const node of nameNodes) {
      if (!isLiteralNode(node)) continue

      for (const character of invalidCharactersIn(node.content, true)) {
        invalidCharacters.add(character)
      }
    }

    if (invalidCharacters.size === 0) return

    const printedName = attributeNode.name ? IdentityPrinter.print(attributeNode.name) : ""

    this.reportInvalidCharacters(printedName, [...invalidCharacters], attributeNode)
  }

  private reportInvalidCharacters(name: string, invalidCharacters: string[], attributeNode: HTMLAttributeNode): void {
    const verb = invalidCharacters.length === 1 ? "is" : "are"

    this.addOffense(
      `Attribute name \`${name}\` contains ${formatCharacterList(invalidCharacters)}, which ${verb} not valid in an HTML attribute name. Use letters, digits, and hyphens.`,
      attributeNode.name?.location ?? attributeNode.location,
    )
  }
}

export class HTMLAttributeNameValidCharactersRule extends ParserRule {
  static ruleName = "html-attribute-name-valid-characters"
  static introducedIn = this.version("unreleased")
  static defaultEnabledIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new HTMLAttributeNameValidCharactersVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
