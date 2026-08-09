import { BaseRuleVisitor } from "./rule-utils.js"

import { PrismVisitor, filterHTMLAttributeNodes, getAttributeName, isPrismNodeType, locationFromByteOffset } from "@herb-tools/core"

import type { ERBBlockNode, ERBContentNode, ERBOpenTagNode, HTMLOpenTagNode, Node, PrismNode } from "@herb-tools/core"
import type { LintContext } from "../types.js"

export interface UJSAttributeDescriptor {
  attribute: string
  dataKey: string
  replacement: { attribute: string, option: string } | null
  keyword?: { name: string, helpers: ReadonlySet<string> }
}

function attributeMessage({ attribute, replacement }: UJSAttributeDescriptor): string {
  if (!replacement) {
    return `Avoid the deprecated \`@rails/ujs\` attribute \`${attribute}\`. Turbo handles links and form submissions by default, so it can be removed.`
  }

  return `Avoid the deprecated \`@rails/ujs\` attribute \`${attribute}\`. Use \`${replacement.attribute}\` instead.`
}

function optionMessage({ attribute, replacement }: UJSAttributeDescriptor): string {
  if (!replacement) {
    return `Avoid the deprecated \`@rails/ujs\` option, which renders \`${attribute}\`. Turbo handles links and form submissions by default, so it can be removed.`
  }

  return `Avoid the deprecated \`@rails/ujs\` option, which renders \`${attribute}\`. Use \`${replacement.option}\` instead.`
}

function symbolKey(node: PrismNode): string | null {
  if (!isPrismNodeType(node, "SymbolNode")) return null

  return node.unescaped?.value ?? null
}

class UJSOptionCollector extends PrismVisitor {
  public readonly keys: PrismNode[] = []

  constructor(private readonly descriptor: UJSAttributeDescriptor) {
    super()
  }

  visitCallNode(node: PrismNode): void {
    this.checkKeywordArguments(node)

    this.visitChildNodes(node)
  }

  private checkKeywordArguments(node: PrismNode): void {
    const argumentNodes = node.arguments_?.arguments_

    if (!Array.isArray(argumentNodes)) return

    const keywords = argumentNodes[argumentNodes.length - 1]

    if (!isPrismNodeType(keywords, "KeywordHashNode")) return

    const { keyword } = this.descriptor

    for (const element of keywords.elements ?? []) {
      if (!isPrismNodeType(element, "AssocNode")) continue

      const key = symbolKey(element.key)

      if (key === null) continue

      if (key === "data") {
        this.checkDataHash(element.value)
      } else if (keyword && key === keyword.name && !node.receiver && keyword.helpers.has(node.name)) {
        this.keys.push(element.key)
      }
    }
  }

  private checkDataHash(hash: PrismNode | null | undefined): void {
    if (!isPrismNodeType(hash, "HashNode") && !isPrismNodeType(hash, "KeywordHashNode")) return

    for (const element of hash.elements ?? []) {
      if (!isPrismNodeType(element, "AssocNode")) continue
      if (symbolKey(element.key) !== this.descriptor.dataKey) continue

      this.keys.push(element.key)
    }
  }
}

export class UJSAttributeVisitor extends BaseRuleVisitor {
  constructor(private readonly descriptor: UJSAttributeDescriptor, ruleName: string, context?: Partial<LintContext>) {
    super(ruleName, context)
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkAttributes(node.children)

    super.visitHTMLOpenTagNode(node)
  }

  visitERBOpenTagNode(node: ERBOpenTagNode): void {
    this.checkAttributes(node.children, true)

    super.visitERBOpenTagNode(node)
  }

  visitERBContentNode(node: ERBContentNode): void {
    this.checkHelperOptions(node.prismNode, node.source)

    super.visitERBContentNode(node)
  }

  visitERBBlockNode(node: ERBBlockNode): void {
    this.checkHelperOptions(node.prismNode, node.source)

    super.visitERBBlockNode(node)
  }

  private checkAttributes(children: Node[] | null | undefined, fromHelper = false): void {
    if (!children) return

    for (const attribute of filterHTMLAttributeNodes(children)) {
      if (getAttributeName(attribute) !== this.descriptor.attribute) continue

      this.addOffense(
        fromHelper ? optionMessage(this.descriptor) : attributeMessage(this.descriptor),
        attribute.name!.location,
        undefined,
        undefined,
        ["deprecated"],
      )
    }
  }

  private checkHelperOptions(prismNode: PrismNode | null | undefined, source: string | null | undefined): void {
    if (!prismNode) return
    if (!source) return

    const collector = new UJSOptionCollector(this.descriptor)

    collector.visit(prismNode)

    for (const key of collector.keys) {
      const { startOffset, length } = key.location

      this.addOffense(
        optionMessage(this.descriptor),
        locationFromByteOffset(source, startOffset, length),
        undefined,
        undefined,
        ["deprecated"],
      )
    }
  }
}
