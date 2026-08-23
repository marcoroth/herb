import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"

import { forEachAttribute, getAttributeName, getStaticAttributeValueContent, getTagLocalName, hasDynamicOutput, getAttributeValueNodes } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBBlockNode, HTMLAttributeNode, HTMLElementNode, Node } from "@herb-tools/core"

const NAME_ATTRIBUTE = "data-herb-name"

interface NamedElement {
  attribute: HTMLAttributeNode
  element: HTMLElementNode
  tag: string | null
  name: string
  scope: ERBBlockNode | null
}

class ValidSlotNamesVisitor extends BaseRuleVisitor {
  public readonly named: NamedElement[] = []
  public readonly attributeSlots = new Map<ERBBlockNode | null, Set<string>>()

  private stack: (ERBBlockNode | null)[] = [null]

  visitERBBlockNode(node: ERBBlockNode): void {
    this.stack.push(node)

    super.visitERBBlockNode(node)

    this.stack.pop()
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (node.open_tag) {
      forEachAttribute(node.open_tag, (attribute) => {
        const attributeName = getAttributeName(attribute)
        if (!attributeName) return

        if (attributeName === NAME_ATTRIBUTE) {
          this.recordNamed(node, attribute)

          return
        }

        if (hasDynamicOutput(getAttributeValueNodes(attribute))) {
          this.recordAttributeSlot(attributeName)
        }
      })
    }

    super.visitHTMLElementNode(node)
  }

  private recordNamed(element: HTMLElementNode, attribute: HTMLAttributeNode): void {
    const tag = getTagLocalName(element)
    const dynamic = hasDynamicOutput(getAttributeValueNodes(attribute))
    const value = dynamic ? null : getStaticAttributeValueContent(attribute)?.trim() ?? ""

    if (value === null || value === "") {
      this.addOffense(
        `\`${NAME_ATTRIBUTE}\` on \`<${tag}>\` must be a static, non-empty value. Write the name out, since a slot name is an address client code resolves and cannot be computed.`,
        attribute.location,
      )

      return
    }

    this.named.push({
      attribute,
      element,
      tag,
      name: value,
      scope: this.stack[this.stack.length - 1],
    })
  }

  private recordAttributeSlot(attributeName: string): void {
    const scope = this.stack[this.stack.length - 1]
    const names = this.attributeSlots.get(scope) ?? new Set<string>()

    names.add(attributeName)

    this.attributeSlots.set(scope, names)
  }

  report(): void {
    const taken = new Map<ERBBlockNode | null, Set<string>>()

    for (const named of this.named) {
      const names = taken.get(named.scope) ?? new Set<string>()

      if (names.has(named.name)) {
        this.addOffense(
          `Two slots in the same scope are both named \`${named.name}\`. Rename one of them, since \`${named.name}\` has to resolve to a single slot.`,
          named.attribute.location,
        )

        continue
      }

      if (this.attributeSlots.get(named.scope)?.has(named.name)) {
        this.addOffense(
          `The name \`${named.name}\` collides with the \`${named.name}\` attribute slot in the same scope. Pick another name, since the attribute is already addressable as \`${named.name}\`.`,
          named.attribute.location,
        )

        continue
      }

      // TODO: the engine also rejects a name ambiguous between several slots at one depth;
      // resolving candidate slots faithfully needs the slot model, so only the clear-cut
      // nothing-dynamic case is reported here.
      if (!containsDynamicContent(named.element)) {
        this.addOffense(
          `\`${NAME_ATTRIBUTE}="${named.name}"\` on \`<${named.tag}>\` names no slot, because the element holds nothing dynamic. Remove the name, or move it onto the element that renders the value.`,
          named.attribute.location,
        )

        continue
      }

      const outer = this.named.find((candidate) =>
        candidate !== named && containsElement(candidate.element, named.element) && !containsERBOutside(candidate.element, named.element),
      )

      if (outer) {
        this.addOffense(
          `\`${NAME_ATTRIBUTE}="${named.name}"\` claims the slot already named \`${outer.name}\`. Keep one name or wrap what each should address, since both elements hold the same slot.`,
          named.attribute.location,
        )

        continue
      }

      names.add(named.name)
      taken.set(named.scope, names)
    }
  }
}

function containsElement(outer: HTMLElementNode, inner: HTMLElementNode): boolean {
  if (outer === inner) return false

  return outer.body.some((child) => containsElementNode(child, inner))
}

function containsElementNode(node: Node, inner: HTMLElementNode): boolean {
  if (node === (inner as unknown as Node)) return true
  if (typeof node.type !== "string") return false

  return childrenOf(node).some((child) => containsElementNode(child, inner))
}

function containsERBOutside(node: Node, excluded: HTMLElementNode): boolean {
  if (node === (excluded as unknown as Node)) return false
  if (typeof node.type !== "string") return false
  if (node.type.startsWith("AST_ERB_")) return true

  return childrenOf(node).some((child) => containsERBOutside(child, excluded))
}

function childrenOf(node: Node): Node[] {
  const parts = node as unknown as { body?: Node[], children?: Node[], open_tag?: Node | null, value?: Node | null, statements?: Node[] }

  return [
    ...(parts.body ?? []),
    ...(parts.children ?? []),
    ...(parts.statements ?? []),
    ...(parts.open_tag ? [parts.open_tag] : []),
    ...(parts.value ? [parts.value] : []),
  ] as Node[]
}

function containsDynamicContent(element: HTMLElementNode): boolean {
  if (element.body.some(containsERB)) return true

  return element.open_tag ? containsERB(element.open_tag) : false
}

function containsERB(node: Node): boolean {
  if (node.type.startsWith("AST_ERB_")) return true

  const parts = (node as unknown as { body?: Node[], children?: Node[], open_tag?: Node | null, value?: Node | null })

  return [
    ...(parts.body ?? []),
    ...(parts.children ?? []),
    ...(parts.open_tag ? [parts.open_tag] : []),
    ...(parts.value && typeof parts.value === "object" ? [parts.value] : []),
  ].some(containsERB)
}

export class HerbValidSlotNamesRule extends ParserRule {
  static ruleName = "herb-valid-slot-names"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ValidSlotNamesVisitor(this.ruleName, context)

    visitor.visit(result.value)
    visitor.report()

    return visitor.offenses
  }
}
