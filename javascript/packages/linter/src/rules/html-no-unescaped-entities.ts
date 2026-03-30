import { ParserRule, Mutable, BaseAutofixContext } from "../types.js"
import { AttributeVisitorMixin, StaticAttributeStaticValueParams, StaticAttributeDynamicValueParams, DynamicAttributeStaticValueParams, DynamicAttributeDynamicValueParams, locationFromContentOffset } from "./rule-utils.js"
import { hasAttributeValue, isLiteralNode, getTagLocalName, Location, isValidCharacterReference } from "@herb-tools/core"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ParserOptions, HTMLTextNode, HTMLElementNode, LiteralNode, Node, HTMLAttributeNode } from "@herb-tools/core"

interface UnescapedEntitiesAutofixContext extends BaseAutofixContext {
  node: Mutable<HTMLTextNode> | Mutable<LiteralNode>
  character: string
  entity: string
}

const AMPERSAND_PATTERN = /&(?:#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*)?;?/g

interface UnescapedOccurrence {
  character: string
  entity: string
  offset: number
}

type FindFn = (value: string) => number[]

interface EntityCheck {
  character: string
  entity: string
  find: FindFn
}

function findAllIndexes(value: string, character: string): number[] {
  const indexes: number[] = []
  let index = value.indexOf(character)

  while (index !== -1) {
    indexes.push(index)
    index = value.indexOf(character, index + 1)
  }

  return indexes
}

function findBareAmpersandIndexes(value: string): number[] {
  const indexes: number[] = []
  const pattern = new RegExp(AMPERSAND_PATTERN.source, "g")
  let match: RegExpExecArray | null

  while ((match = pattern.exec(value)) !== null) {
    if (!isValidCharacterReference(match[0])) {
      indexes.push(match.index)
    }
  }

  return indexes
}

const ENTITY_CHECKS: EntityCheck[] = [
  { character: "<", entity: "&lt;", find: (value) => findAllIndexes(value, "<") },
  { character: ">", entity: "&gt;", find: (value) => findAllIndexes(value, ">") },
  { character: "&", entity: "&amp;", find: findBareAmpersandIndexes },
]

function findUnescapedOccurrences(value: string): UnescapedOccurrence[] {
  const occurrences: UnescapedOccurrence[] = []

  for (const entry of ENTITY_CHECKS) {
    for (const offset of entry.find(value)) {
      occurrences.push({ character: entry.character, entity: entry.entity, offset })
    }
  }

  return occurrences
}

const RAW_TEXT_ELEMENTS = new Set(["script", "style"])

class HTMLNoUnescapedEntitiesVisitor extends AttributeVisitorMixin<UnescapedEntitiesAutofixContext> {
  private elementStack: string[] = []

  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)

    if (tagName) {
      this.elementStack.push(tagName)
    }

    super.visitHTMLElementNode(node)

    if (tagName) {
      this.elementStack.pop()
    }
  }

  private get insideRawTextElement(): boolean {
    return this.elementStack.some((tagName) => RAW_TEXT_ELEMENTS.has(tagName))
  }

  visitHTMLTextNode(node: HTMLTextNode): void {
    if (this.insideRawTextElement) {
      super.visitHTMLTextNode(node)
      return
    }

    const content = node.content
    if (!content) return

    const occurrences = findUnescapedOccurrences(content)
    const startLine = node.location.start.line
    const startColumn = node.location.start.column

    for (const { character, entity, offset } of occurrences) {
      const location = locationFromContentOffset(startLine, startColumn, content, offset)

      this.addOffense(
        `Text content contains an unescaped \`${character}\` character. Use \`${entity}\` instead.`,
        location,
        { node, character, entity, unsafe: true },
      )
    }

    super.visitHTMLTextNode(node)
  }

  private checkAttributeValue(attributeName: string, attributeValue: string, attributeNode: HTMLAttributeNode): void {
    if (!hasAttributeValue(attributeNode)) return
    if (!attributeValue) return

    const literalNode = attributeNode.value!.children.find((child) => isLiteralNode(child))
    if (!literalNode || !isLiteralNode(literalNode)) return

    const occurrences = findUnescapedOccurrences(attributeValue)
    const startLine = attributeNode.value!.location.start.line
    const startColumn = attributeNode.value!.location.start.column

    for (const { character, entity, offset } of occurrences) {
      const location = locationFromContentOffset(startLine, startColumn, attributeValue, offset)

      this.addOffense(
        `Attribute \`${attributeName}\` contains an unescaped \`${character}\` character. Use \`${entity}\` instead.`,
        location,
        { node: literalNode, character, entity, unsafe: true },
      )
    }
  }

  private checkLiteralValueNodes(attributeName: string, valueNodes: Node[], attributeNode: HTMLAttributeNode): void {
    if (!hasAttributeValue(attributeNode)) return

    for (const node of valueNodes) {
      if (!isLiteralNode(node)) continue
      if (!node.content) continue

      const occurrences = findUnescapedOccurrences(node.content)
      const startLine = node.location.start.line
      const startColumn = node.location.start.column

      for (const { character, entity, offset } of occurrences) {
        const location = locationFromContentOffset(startLine, startColumn, node.content, offset)

        this.addOffense(
          `Attribute \`${attributeName}\` contains an unescaped \`${character}\` character. Use \`${entity}\` instead.`,
          location,
          { node, character, entity, unsafe: true },
        )
      }
    }
  }

  protected checkStaticAttributeStaticValue({ attributeName, attributeValue, attributeNode }: StaticAttributeStaticValueParams): void {
    this.checkAttributeValue(attributeName, attributeValue, attributeNode)
  }

  protected checkStaticAttributeDynamicValue({ attributeName, valueNodes, attributeNode }: StaticAttributeDynamicValueParams): void {
    this.checkLiteralValueNodes(attributeName, valueNodes, attributeNode)
  }

  protected checkDynamicAttributeStaticValue({ combinedName, attributeValue, attributeNode }: DynamicAttributeStaticValueParams): void {
    const attributeName = combinedName || "unknown"
    this.checkAttributeValue(attributeName, attributeValue, attributeNode)
  }

  protected checkDynamicAttributeDynamicValue({ combinedName, valueNodes, attributeNode }: DynamicAttributeDynamicValueParams): void {
    const attributeName = combinedName || "unknown"
    this.checkLiteralValueNodes(attributeName, valueNodes, attributeNode)
  }
}

export class HTMLNoUnescapedEntitiesRule extends ParserRule<UnescapedEntitiesAutofixContext> {
  static ruleName = "html-no-unescaped-entities"
  static introducedIn = this.version("0.9.3")
  static unsafeAutocorrectable = true

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<UnescapedEntitiesAutofixContext>[] {
    const visitor = new HTMLNoUnescapedEntitiesVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<UnescapedEntitiesAutofixContext>, result: ParseResult): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node } = offense.autofixContext

    node.content = node.content.replace(new RegExp(AMPERSAND_PATTERN.source, "g"), (match) => {
      if (isValidCharacterReference(match)) return match
      return "&amp;" + match.slice(1)
    })
    node.content = node.content.replaceAll("<", "&lt;")
    node.content = node.content.replaceAll(">", "&gt;")

    return result
  }
}
