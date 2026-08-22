import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"
import { ACTION_ATTRIBUTE_SCHEMA, BY_ATTRIBUTE, StateScopeMap, collectCountedFolds, declaredKind, isActionAttribute, isDerived, kindWithArticle } from "../utils/state-directives-utils.js"
import { balancedQuotes, clauses, names, splitOutsideQuotes, unquote } from "@herb-tools/client/directives"

import { forEachAttribute, getAttributeName, getStaticAttributeValueContent, hasDynamicOutput, getAttributeValueNodes } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ParserOptions, ERBBlockNode, HTMLOpenTagNode, HTMLAttributeNode, ERBOpenTagNode } from "@herb-tools/core"
import type { ActionClause, ActionAttribute } from "../utils/state-directives-utils.js"
import type { StateDeclaration } from "@herb-tools/client/directives"

class StateValidActionsVisitor extends BaseRuleVisitor {
  private states: StateScopeMap
  private counted: Set<string>
  private stack: (ERBBlockNode | null)[] = [null]

  constructor(ruleName: string, states: StateScopeMap, counted: Set<string>, context?: Partial<LintContext>) {
    super(ruleName, context)

    this.states = states
    this.counted = counted
  }

  visitERBBlockNode(node: ERBBlockNode): void {
    this.stack.push(node)

    super.visitERBBlockNode(node)

    this.stack.pop()
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    forEachAttribute(node, (attribute) => {
      const name = getAttributeName(attribute)

      if (name && isActionAttribute(name)) this.checkAction(attribute, name)
      if (name === BY_ATTRIBUTE) this.checkBy(attribute)
    })

    super.visitHTMLOpenTagNode(node)
  }

  visitERBOpenTagNode(node: ERBOpenTagNode): void {
    forEachAttribute(node, (attribute) => {
      const name = getAttributeName(attribute)

      if (name && isActionAttribute(name)) this.checkAction(attribute, name)
      if (name === BY_ATTRIBUTE) this.checkBy(attribute)
    })

    super.visitERBOpenTagNode(node)
  }

  private checkAction(attribute: HTMLAttributeNode, name: ActionAttribute): void {
    if (getAttributeValueNodes(attribute).some((valueNode) => hasDynamicOutput([valueNode]))) return

    const value = getStaticAttributeValueContent(attribute)

    if (value === null) return

    if (!balancedQuotes(value)) {
      this.addOffense(
        `\`${name}="${value}"\` has an unbalanced quote. Close the \`'\`, since separators inside quotes stay literal.`,
        attribute.location,
      )

      return
    }

    for (const clause of clauses(value)) {
      this.checkClause(attribute, name, clause)
    }
  }

  private checkClause(attribute: HTMLAttributeNode, name: ActionAttribute, clause: ActionClause): void {
    const schema: { operation: string, needs?: string, bare?: boolean } = ACTION_ATTRIBUTE_SCHEMA[name]

    if (clause.event === "" || (clause.rest.trim() === "" && !schema.bare)) {
      this.addOffense(
        clause.event === ""
          ? `\`${name}\` has a clause with no event before the arrow. Name one, like \`click->\`, or drop the arrow to use the element's default event.`
          : `\`${name}\` has a clause with nothing after the event. Name the state to write, like \`${clause.event}->open\`.`,
        attribute.location,
      )

      return
    }

    if (schema.operation === "set") {
      for (const assignment of splitOutsideQuotes(clause.rest, ",")) {
        this.checkAssignment(attribute, assignment)
      }

      return
    }

    for (const stateName of names(clause.rest)) {
      const declaration = this.declarationOf(attribute, stateName)

      if (!declaration) continue

      if (isDerived(declaration)) {
        this.addOffense(
          `\`${name}\` on \`${stateName}\` can never work, because \`${stateName}\` is derived from \`${declaration.defaultSource}\`. Write the states it reads instead.`,
          attribute.location,
        )

        continue
      }

      if (this.counted.has(stateName)) {
        this.addOffense(
          `\`${name}\` on \`${stateName}\` can never work, because \`${stateName}\` is counted from the template's loop. Write the item states its condition reads instead.`,
          attribute.location,
        )

        continue
      }

      if (!schema.needs) continue

      const kind = declaredKind(declaration)

      if (kind !== schema.needs && kind !== "seeded") {
        const advice = schema.needs === "boolean"
          ? `Set a value instead, like \`data-herb-set="${stateName}=..."\`, or declare a boolean flag`
          : `Declare it as an Integer, like \`(${stateName}: 0)\``

        this.addOffense(
          `\`${name}\` on \`${stateName}\` can never work, because \`${stateName}\` is ${kindWithArticle(kind)} and it needs ${kindWithArticle(schema.needs)}. ${advice}.`,
          attribute.location,
        )
      }
    }
  }

  private checkAssignment(attribute: HTMLAttributeNode, assignment: string): void {
    const separator = assignment.indexOf("=")

    if (assignment.trim() === "") {
      this.addOffense(
        "`data-herb-set` has an empty clause. Remove the stray comma or space, since every clause has to be a `state=value` pair.",
        attribute.location,
      )

      return
    }

    if (separator < 1) {
      this.addOffense(
        `\`${assignment.trim()}\` in \`data-herb-set\` is not a \`state=value\` pair. Write the value to set, like \`${assignment.trim()}=true\`, or use \`data-herb-toggle\` to flip a boolean.`,
        attribute.location,
      )

      return
    }

    const name = assignment.slice(0, separator).trim()
    const raw = unquote(assignment.slice(separator + 1).trim())
    const declaration = this.declarationOf(attribute, name)

    if (!declaration) return

    if (isDerived(declaration)) {
      this.addOffense(
        `\`${name}=${raw}\` can never work, because \`${name}\` is derived from \`${declaration.defaultSource}\`. Write the states it reads instead.`,
        attribute.location,
      )

      return
    }

    if (this.counted.has(name)) {
      this.addOffense(
        `\`${name}=${raw}\` can never work, because \`${name}\` is counted from the template's loop. Write the item states its condition reads instead.`,
        attribute.location,
      )

      return
    }

    if (raw === "$value") return

    const kind = declaredKind(declaration)

    if ((kind === "boolean" && raw !== "true" && raw !== "false") || (kind === "integer" && !/^-?\d+$/.test(raw))) {
      const advice = kind === "boolean"
        ? `Use \`${name}=true\` or \`${name}=false\``
        : `Use a whole number, like \`${name}=0\``

      this.addOffense(
        `\`${name}=${raw}\` does not parse as ${kind === "integer" ? "an Integer" : "a Boolean"}, and \`${name}\` is declared as one. ${advice}.`,
        attribute.location,
      )
    }
  }

  private checkBy(attribute: HTMLAttributeNode): void {
    if (getAttributeValueNodes(attribute).some((valueNode) => hasDynamicOutput([valueNode]))) return

    const value = getStaticAttributeValueContent(attribute)

    if (value === null || /^-?\d+$/.test(value.trim())) return

    this.addOffense(
      `\`${BY_ATTRIBUTE}="${value}"\` is not an integer, so the step falls back to 1. Use a whole number, like \`${BY_ATTRIBUTE}="2"\`.`,
      attribute.location,
    )
  }

  private declarationOf(attribute: HTMLAttributeNode, name: string): StateDeclaration | null {
    const declaration = this.states.resolve(this.stack, name)

    if (declaration) return declaration

    if (!this.states.hasDeclarations) return null

    const inScope = this.states.namesIn(this.stack)
    const listing = inScope.length > 0 ? ` States in scope: ${inScope.map((state) => `\`${state}\``).join(", ")}.` : ""

    this.addOffense(
      `Nothing in scope here declares the state \`${name}\`. Declare it with \`<%# herb:state (${name}: ...) %>\`, or use one of the states in scope.${listing}`,
      attribute.location,
    )

    return null
  }
}

export class HerbStateValidActionsRule extends ParserRule {
  static ruleName = "herb-state-valid-actions"
  static introducedIn = this.version("unreleased")

  get parserOptions(): Partial<ParserOptions> {
    return {
      strict_locals: true,
      action_view_helpers: true,
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
    const counted = new Set(collectCountedFolds(result.value, states).map((fold) => fold.name))
    const visitor = new StateValidActionsVisitor(this.ruleName, states, counted, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
