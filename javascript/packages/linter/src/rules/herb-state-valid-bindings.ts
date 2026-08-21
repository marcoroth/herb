import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"
import { StateScopeMap, declaredKind, isDerived } from "../utils/state-directives-utils.js"
import { bareReadName } from "@herb-tools/client/directives"

import { forEachAttribute, getAttributeName, getAttributeValueNodes, getTagLocalName, isERBContentNode, isHTMLElementNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ParserOptions, ERBBlockNode, ERBContentNode, HTMLElementNode, Node } from "@herb-tools/core"
import type { StateDeclaration } from "@herb-tools/client/directives"

const BOUND_ELEMENTS = ["input", "textarea", "select", "option"]
const BOOLEAN_ATTRIBUTES = ["checked", "selected"]
const TEXT_KINDS = ["string", "integer", "seeded"]

class StateValidBindingsVisitor extends BaseRuleVisitor {
  private states: StateScopeMap
  private stack: (ERBBlockNode | null)[] = [null]

  constructor(ruleName: string, states: StateScopeMap, context?: Partial<LintContext>) {
    super(ruleName, context)

    this.states = states
  }

  visitERBBlockNode(node: ERBBlockNode): void {
    this.stack.push(node)

    super.visitERBBlockNode(node)

    this.stack.pop()
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    const tag = getTagLocalName(node)

    if (tag && BOUND_ELEMENTS.includes(tag)) {
      this.checkAttributes(node, tag)

      if (tag === "textarea") this.checkTextareaContent(node)
    }

    super.visitHTMLElementNode(node)
  }

  private checkAttributes(node: HTMLElementNode, tag: string): void {
    if (!node.open_tag) return

    forEachAttribute(node.open_tag, (attribute) => {
      const attributeName = getAttributeName(attribute)

      if (attributeName !== "value" && !BOOLEAN_ATTRIBUTES.includes(attributeName ?? "")) return

      const read = this.boundRead(getAttributeValueNodes(attribute))

      if (!read) return

      const [name, declaration] = read

      if (isDerived(declaration)) {
        this.addOffense(
          `\`${attributeName}\` binds the derived state \`${name}\`, and a binding writes back what the user changes. A derived state cannot be written, so bind one of its sources, or show the value outside a form control.`,
          attribute.location,
        )

        return
      }

      const kind = declaredKind(declaration)

      if (BOOLEAN_ATTRIBUTES.includes(attributeName!)) {
        if (kind !== "boolean" && kind !== "seeded") {
          this.addOffense(
            `\`${attributeName}\` binds the ${capitalize(kind)} state \`${name}\`, and \`${attributeName}\` holds a boolean. Declare it as one, like \`(${name}: false)\`, or bind a different state.`,
            attribute.location,
          )
        }

        return
      }

      if (!TEXT_KINDS.includes(kind)) {
        this.addOffense(
          `\`value\` on \`<${tag}>\` binds the ${capitalize(kind)} state \`${name}\`, and a \`value\` holds text. Declare it as a String, like \`(${name}: "")\`.`,
          attribute.location,
        )
      }
    })
  }

  private checkTextareaContent(node: HTMLElementNode): void {
    const read = this.boundRead(node.body)

    if (!read) return

    const [name, declaration] = read

    if (isDerived(declaration)) {
      this.addOffense(
        `\`<textarea>\` binds the derived state \`${name}\`, and a binding writes back what the user changes. A derived state cannot be written, so bind one of its sources, or show the value outside a form control.`,
        node.location,
      )

      return
    }

    const kind = declaredKind(declaration)

    if (!TEXT_KINDS.includes(kind)) {
      this.addOffense(
        `\`<textarea>\` binds the ${capitalize(kind)} state \`${name}\`, and a textarea holds text. Declare it as a String, like \`(${name}: "")\`.`,
        node.location,
      )
    }
  }

  private boundRead(nodes: Node[]): [string, StateDeclaration] | null {
    const outputs = nodes.filter((child): child is ERBContentNode => {
      if (!isERBContentNode(child)) return false

      return child.tag_opening?.value === "<%=" || child.tag_opening?.value === "<%=="
    })

    if (outputs.length !== 1) return null

    const meaningful = nodes.filter((child) => {
      if (isHTMLElementNode(child)) return true

      return false
    })

    if (meaningful.length > 0) return null

    const name = bareReadName(outputs[0].content?.value ?? "")

    if (!name) return null

    const declaration = this.states.resolve(this.stack, name)

    return declaration ? [name, declaration] : null
  }
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

export class HerbStateValidBindingsRule extends ParserRule {
  static ruleName = "herb-state-valid-bindings"
  static introducedIn = this.version("unreleased")

  get parserOptions(): Partial<ParserOptions> {
    return {
      strict_locals: true,
    }
  }

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const states = StateScopeMap.collect(result.value)

    if (!states.hasDeclarations) return []

    const visitor = new StateValidBindingsVisitor(this.ruleName, states, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
