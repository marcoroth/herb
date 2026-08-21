import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"
import { isERBComment } from "../utils/state-directives-utils.js"
import { HERB_ATTRIBUTES } from "@herb-tools/client/directives"

import { forEachAttribute, getAttributeName, getStaticAttributeValueContent, hasDynamicOutput, getAttributeValueNodes, isERBContentNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLAttributeNode, HTMLElementNode, Node } from "@herb-tools/core"

const KEY_DIRECTIVE = /^\s*herb:key\b/

interface IntoTarget {
  attribute: HTMLAttributeNode
  value: string | null
}

class IntoRequiresCollectionVisitor extends BaseRuleVisitor {
  public readonly targets: IntoTarget[] = []
  public readonly collections = new Set<string>()
  public readonly named = new Set<string>()

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (node.open_tag) {
      forEachAttribute(node.open_tag, (attribute) => {
        const attributeName = getAttributeName(attribute)

        if (attributeName === HERB_ATTRIBUTES.into) {
          const dynamic = hasDynamicOutput(getAttributeValueNodes(attribute))

          this.targets.push({ attribute, value: dynamic ? null : getStaticAttributeValueContent(attribute)?.trim() ?? "" })
        }

        if (attributeName === HERB_ATTRIBUTES.name) {
          const name = getStaticAttributeValueContent(attribute)?.trim()

          if (name) {
            this.named.add(name)

            if (holdsKeyedLoop(node)) this.collections.add(name)
          }
        }
      })
    }

    super.visitHTMLElementNode(node)
  }

  report(): void {
    for (const target of this.targets) {
      if (target.value === null || target.value === "") {
        this.addOffense(
          `\`${HERB_ATTRIBUTES.into}\` must be a static, non-empty value. Write the collection's name out, since a send target is an address client code resolves.`,
          target.attribute.location,
        )

        continue
      }

      if (this.collections.has(target.value)) continue

      if (this.named.has(target.value)) {
        this.addOffense(
          `\`${HERB_ATTRIBUTES.into}="${target.value}"\` names a slot that is not a keyed collection. A send inserts an item, so name the element around a keyed loop.`,
          target.attribute.location,
        )

        continue
      }

      const listing = this.collections.size > 0 ? ` Collections in this template: ${[...this.collections].map((name) => `\`${name}\``).join(", ")}.` : ""

      this.addOffense(
        `\`${HERB_ATTRIBUTES.into}="${target.value}"\` names nothing in this template. Name a keyed collection with \`${HERB_ATTRIBUTES.name}\` on the element around the loop.${listing}`,
        target.attribute.location,
      )
    }
  }
}

function holdsKeyedLoop(element: HTMLElementNode): boolean {
  return element.body.some(containsKeyedBlock)
}

function containsKeyedBlock(node: Node): boolean {
  const parts = node as unknown as { body?: Node[], children?: Node[], statements?: Node[] }
  const children = [...(parts.body ?? []), ...(parts.children ?? []), ...(parts.statements ?? [])]

  if (node.type === "AST_ERB_BLOCK_NODE" && children.some(keysItems)) return true

  return children.some(containsKeyedBlock)
}

function keysItems(node: Node): boolean {
  if (isERBContentNode(node) && isERBComment(node) && KEY_DIRECTIVE.test(node.content?.value ?? "")) return true
  if (node.type !== "AST_HTML_ELEMENT_NODE") return false

  const element = node as HTMLElementNode

  if (!element.open_tag) return false

  let keyed = false

  forEachAttribute(element.open_tag, (attribute) => {
    const name = getAttributeName(attribute)

    if ((name === "id" || name === "herb-key") && hasDynamicOutput(getAttributeValueNodes(attribute))) keyed = true
  })

  return keyed
}

export class HerbIntoRequiresCollectionRule extends ParserRule {
  static ruleName = "herb-into-requires-collection"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new IntoRequiresCollectionVisitor(this.ruleName, context)

    visitor.visit(result.value)
    visitor.report()

    return visitor.offenses
  }
}
