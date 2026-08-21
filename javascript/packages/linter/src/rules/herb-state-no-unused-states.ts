import { BaseRuleVisitor, locationFromContentOffset } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"
import { BY_ATTRIBUTE, isActionAttribute, isERBComment, isStateDirective, stateSignatureOf } from "../utils/state-directives-utils.js"
import { mentionsAnyState } from "@herb-tools/client/directives"

import { Location, forEachAttribute, getAttributeName, getStaticAttributeValueContent } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ParserOptions, ERBBlockNode, ERBCaseNode, ERBContentNode, ERBIfNode, ERBUnlessNode, ERBWhenNode, HTMLOpenTagNode, Node } from "@herb-tools/core"
import type { StateDeclaration } from "@herb-tools/client/directives"

interface TrackedDeclaration {
  node: ERBContentNode
  declaration: StateDeclaration
  scope: ERBBlockNode | null
  used: boolean
}

interface Use {
  source: string
  stack: (ERBBlockNode | null)[]
}

class UnusedStatesVisitor extends BaseRuleVisitor {
  public readonly declarations: TrackedDeclaration[] = []
  public readonly uses: Use[] = []

  private stack: (ERBBlockNode | null)[] = [null]

  visitERBBlockNode(node: ERBBlockNode): void {
    this.markUses(node.content?.value ?? "")
    this.stack.push(node)

    super.visitERBBlockNode(node)

    this.stack.pop()
  }

  visitERBIfNode(node: ERBIfNode): void {
    this.markUses(node.content?.value ?? "")

    super.visitERBIfNode(node)
  }

  visitERBUnlessNode(node: ERBUnlessNode): void {
    this.markUses(node.content?.value ?? "")

    super.visitERBUnlessNode(node)
  }

  visitERBCaseNode(node: ERBCaseNode): void {
    this.markUses(node.content?.value ?? "")

    super.visitERBCaseNode(node)
  }

  visitERBWhenNode(node: ERBWhenNode): void {
    this.markUses(node.content?.value ?? "")

    super.visitERBWhenNode(node)
  }

  visitERBContentNode(node: ERBContentNode): void {
    if (isStateDirective(node)) {
      const parsed = stateSignatureOf(node)

      if (parsed && !parsed.malformed) {
        const scope = this.stack[this.stack.length - 1]

        for (const declaration of parsed.declarations) {
          this.declarations.push({ node, declaration, scope, used: false })
        }
      }

      return
    }

    if (isERBComment(node)) return

    this.markUses(node.content?.value ?? "")
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    forEachAttribute(node, (attribute) => {
      const attributeName = getAttributeName(attribute)

      if (!attributeName) return
      if (!isActionAttribute(attributeName) && attributeName !== BY_ATTRIBUTE) return

      this.markUses(getStaticAttributeValueContent(attribute) ?? "")
    })

    super.visitHTMLOpenTagNode(node)
  }

  private markUses(source: string): void {
    if (source === "") return

    this.uses.push({ source, stack: [...this.stack] })
  }

  reportUnused(): void {
    for (const tracked of this.declarations) {
      tracked.used = this.uses.some((use) =>
        use.stack.includes(tracked.scope) && mentionsAnyState(use.source, [tracked.declaration.name]),
      )

      if (tracked.used) continue

      this.addOffense(
        `The state \`${tracked.declaration.name}\` is never read or written in this template. Remove it, or disable this line when only app code uses it through \`stateFor\` or \`useState\`.`,
        nameLocation(tracked.node, tracked.declaration),
      )
    }
  }
}

export class HerbStateNoUnusedStatesRule extends ParserRule {
  static ruleName = "herb-state-no-unused-states"
  static introducedIn = this.version("unreleased")

  get parserOptions(): Partial<ParserOptions> {
    return {
      strict_locals: true,
    }
  }

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new UnusedStatesVisitor(this.ruleName, context)

    visitor.visit(result.value)
    visitor.reportUnused()

    return visitor.offenses
  }
}

function nameLocation(node: ERBContentNode, declaration: StateDeclaration): Node["location"] {
  const content = node.content

  if (!content) return node.location

  const base = content.location.start
  const start = locationFromContentOffset(base.line, base.column, content.value, declaration.nameOffset).start
  const end = locationFromContentOffset(base.line, base.column, content.value, declaration.nameOffset + declaration.name.length).start

  return new Location(start, end)
}
