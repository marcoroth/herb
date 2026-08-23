import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"
import { StateScopeMap, declaredKind, kindWithArticle } from "../utils/state-directives-utils.js"
import { bareReadName, mentionsAnyState } from "@herb-tools/client/directives"

import { isBooleanAttribute, locationFromByteOffset, substringFromByteOffset } from "@herb-tools/core"
import { getAttributeName, getAttributeValueNodes, isERBContentNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ParserOptions, Location, PrismNode, ERBBlockNode, ERBContentNode, ERBIfNode, ERBUnlessNode, ERBCaseNode, HTMLAttributeNode } from "@herb-tools/core"
import type { StateDeclaration } from "@herb-tools/client/directives"

const LITERAL_KINDS: Record<string, string> = {
  TrueNode: "boolean",
  FalseNode: "boolean",
  IntegerNode: "integer",
  StringNode: "string",
  SymbolNode: "symbol",
  NilNode: "nil",
}

interface BareRead {
  name: string
  predicate: boolean
}

function prismType(node: PrismNode | null | undefined): string {
  return node?.constructor?.name ?? ""
}

function prismBareRead(node: PrismNode | null | undefined): BareRead | null {
  if (prismType(node) === "LocalVariableReadNode") {
    return { name: String(node.name), predicate: false }
  }

  if (prismType(node) !== "CallNode") return null
  if (node.receiver || node.block) return null
  if (node.arguments_?.arguments_?.length) return null

  const spelled = String(node.name)
  const predicate = spelled.endsWith("?")

  return { name: predicate ? spelled.slice(0, -1) : spelled, predicate }
}

function equalitySides(node: PrismNode): [PrismNode, PrismNode] | null {
  if (prismType(node) !== "CallNode") return null
  if (String(node.name) !== "==") return null
  if (!node.receiver) return null
  if (node.arguments_?.arguments_?.length !== 1) return null

  return [node.receiver, node.arguments_.arguments_[0]]
}

class StateValidReadsVisitor extends BaseRuleVisitor {
  private states: StateScopeMap
  private source: string
  private stack: (ERBBlockNode | null)[] = [null]
  private booleanAttribute = false

  constructor(ruleName: string, states: StateScopeMap, source: string, context?: Partial<LintContext>) {
    super(ruleName, context)

    this.states = states
    this.source = source
  }

  visitERBBlockNode(node: ERBBlockNode): void {
    this.stack.push(node)

    super.visitERBBlockNode(node)

    this.stack.pop()
  }

  visitHTMLAttributeNode(node: HTMLAttributeNode): void {
    const name = getAttributeName(node)
    const previous = this.booleanAttribute

    this.booleanAttribute = name !== null && isBooleanAttribute(name)

    this.checkMixedInterpolation(node)

    super.visitHTMLAttributeNode(node)

    this.booleanAttribute = previous
  }

  private checkMixedInterpolation(node: HTMLAttributeNode): void {
    const outputs = getAttributeValueNodes(node).filter((child) =>
      isERBContentNode(child) && (child.tag_opening?.value === "<%=" || child.tag_opening?.value === "<%=="),
    ) as ERBContentNode[]

    if (outputs.length < 2) return

    const names = this.states.namesIn(this.stack)
    if (names.length === 0) return

    const read = outputs.map((output) => output.content?.value.trim() ?? "").find((expression) => expression !== "" && mentionsAnyState(expression, names))
    if (!read) return

    this.addOffense(
      `\`${read}\` reads a state inside an interpolated attribute that mixes other dynamic parts. Give the state its own attribute or its own output, since a state write cannot supply the other values.`,
      node.location,
    )
  }

  visitERBContentNode(node: ERBContentNode): void {
    if (node.tag_opening?.value !== "<%=" && node.tag_opening?.value !== "<%==") return

    const names = this.states.namesIn(this.stack)

    if (names.length === 0) return

    const expression = node.content?.value.trim() ?? ""

    if (expression === "" || !mentionsAnyState(withoutActionHashValues(expression), names)) return

    if (this.booleanAttribute) {
      const prism = node.prismNode

      if (prism) this.classifyPredicate(prism, names)

      return
    }

    const bare = bareReadName(expression)

    if (bare && this.resolve(bare)) return

    const name = names.find(candidate => mentionsAnyState(expression, [candidate])) ?? names[0]

    this.addOffense(
      `\`${expression}\` computes with the state \`${name}\`, and the client cannot run Ruby to keep the result current. Show the value with \`<%= ${name} %>\`, or declare a second state for the computed answer and set it from app code.`,
      node.location,
    )
  }

  visitERBUnlessNode(node: ERBUnlessNode): void {
    const prism = node.prismNode

    if (prismType(prism) === "UnlessNode" && prism.predicate) {
      const names = this.states.namesIn(this.stack)
      const expression = this.sliceOf(prism.predicate)

      if (names.length > 0 && mentionsAnyState(expression, names)) {
        this.addOffense(
          `\`unless ${expression}\` reads a state. Spell it as an \`if\` with the arms swapped, so each arm maps to a branch the client can name.`,
          this.locationOf(prism.predicate),
        )
      }
    }

    super.visitERBUnlessNode(node)
  }

  visitERBIfNode(node: ERBIfNode): void {
    const prism = node.prismNode

    if (prismType(prism) === "IfNode") {
      this.checkConditionalChain(prism)
    }

    super.visitERBIfNode(node)
  }

  visitERBCaseNode(node: ERBCaseNode): void {
    const prism = node.prismNode

    if (prismType(prism) === "CaseNode") {
      this.checkCase(prism)
    }

    super.visitERBCaseNode(node)
  }

  private checkConditionalChain(prism: PrismNode): void {
    const names = this.states.namesIn(this.stack)

    if (names.length === 0) return

    let stateDriven = false
    let current: PrismNode | null = prism

    while (prismType(current) === "IfNode") {
      const predicate = current.predicate

      if (!predicate) return

      const read = this.classifyPredicate(predicate, names)

      if (read === "reported") return

      if (read === "state") {
        stateDriven = true
        current = current.subsequent

        continue
      }

      if (stateDriven) {
        this.addOffense(
          `\`${this.sliceOf(predicate)}\` sits in a state-driven conditional but reads no state. Move it into its own conditional, or read a state in this arm, since the client resolves every arm itself.`,
          this.locationOf(predicate),
        )
      }

      return
    }
  }

  private classifyPredicate(predicate: PrismNode, names: readonly string[]): "state" | "other" | "reported" {
    const bare = prismBareRead(predicate)

    if (bare) {
      const declaration = this.resolve(bare.name)

      if (!declaration) return "other"

      if (bare.predicate) {
        const kind = declaredKind(declaration)

        if (kind !== "boolean" && kind !== "seeded") {
          this.addOffense(
            `\`${this.sliceOf(predicate)}\` reads the ${capitalize(kind)} state \`${bare.name}\` as a predicate. Write \`${bare.name}\` bare, or declare a boolean flag. Only a boolean state reads with a \`?\`.`,
            this.locationOf(predicate),
          )

          return "reported"
        }
      }

      return "state"
    }

    const sides = equalitySides(predicate)

    if (sides) {
      const [left, right] = sides
      const leftRead = prismBareRead(left)
      const rightRead = prismBareRead(right)
      const declaration = (leftRead && this.resolve(leftRead.name)) || (rightRead && this.resolve(rightRead.name)) || null

      if (declaration) {
        const comparand = leftRead && this.resolve(leftRead.name) ? right : left
        const comparandKind = LITERAL_KINDS[prismType(comparand)]
        const kind = declaredKind(declaration)

        if (!comparandKind) {
          const example = kind === "seeded" ? "" : `, like \`${declaration.name} == ${declaration.defaultSource}\``

          this.addOffense(
            `\`${this.sliceOf(predicate)}\` compares the state \`${declaration.name}\` against something that is not a literal. Compare against a literal${example}, since the client resolves a comparison by lookup.`,
            this.locationOf(predicate),
          )

          return "reported"
        }

        if (kind !== "seeded" && comparandKind !== "nil" && comparandKind !== kind) {
          this.addOffense(
            `\`${this.sliceOf(predicate)}\` compares the ${capitalize(kind)} state \`${declaration.name}\` against ${kindWithArticle(comparandKind)} literal, so it can never match. Compare against a ${capitalize(kind)}, or redeclare the state.`,
            this.locationOf(predicate),
          )

          return "reported"
        }

        return "state"
      }
    }

    if (mentionsAnyState(this.sliceOf(predicate), names)) {
      const name = names.find(candidate => mentionsAnyState(this.sliceOf(predicate), [candidate])) ?? names[0]

      this.addOffense(
        `\`${this.sliceOf(predicate)}\` computes with the state \`${name}\`, and the client cannot run Ruby to pick the branch. ${this.conditionAdvice(name)}`,
        this.locationOf(predicate),
      )

      return "reported"
    }

    return "other"
  }

  private checkCase(prism: PrismNode): void {
    const names = this.states.namesIn(this.stack)

    if (names.length === 0) return

    const subject = prism.predicate

    if (!subject) return

    const subjectText = this.sliceOf(subject)

    if (!mentionsAnyState(subjectText, names)) return

    const bare = prismBareRead(subject)
    const declaration = bare && !bare.predicate ? this.resolve(bare.name) : null

    if (!declaration) {
      const example = bare ? `, like \`case ${bare.name}\`` : ""

      this.addOffense(
        `\`case ${subjectText}\` does not switch on a bare state read. Write the state alone${example}, or compute the value into its own state.`,
        this.locationOf(subject),
      )

      return
    }

    const kind = declaredKind(declaration)

    for (const when of prism.conditions ?? []) {
      if (prismType(when) !== "WhenNode") continue

      const list = (when.conditions ?? []).map((condition: PrismNode) => this.sliceOf(condition)).join(", ")

      for (const condition of when.conditions ?? []) {
        const comparandKind = LITERAL_KINDS[prismType(condition)]

        if (!comparandKind) {
          this.addOffense(
            `\`when ${list}\` on the state \`${declaration.name}\` has a comparand that is not a literal. List literals, like \`when "name", "date"\`, since the client resolves a \`when\` by lookup.`,
            this.locationOf(condition),
          )

          break
        }

        if (kind !== "seeded" && comparandKind !== "nil" && comparandKind !== kind) {
          this.addOffense(
            `\`when ${list}\` compares the ${capitalize(kind)} state \`${declaration.name}\` against a literal of another type, so it can never match. Use ${capitalize(kind)} literals in every arm.`,
            this.locationOf(condition),
          )

          break
        }
      }
    }
  }

  private conditionAdvice(name: string): string {
    const declaration = this.resolve(name)
    const kind = declaration ? declaredKind(declaration) : "seeded"

    if (kind === "boolean") {
      return `Read it bare, \`<% if ${name} %>\`, or as \`${name}?\`.`
    }

    if ((kind === "string" || kind === "integer" || kind === "symbol") && declaration) {
      return `Read it bare, \`<% if ${name} %>\`, or compare it to a literal, \`${name} == ${declaration.defaultSource}\`.`
    }

    return `Read it bare, \`<% if ${name} %>\`, or compare it to a literal.`
  }

  private resolve(name: string): StateDeclaration | undefined {
    return this.states.resolve(this.stack, name)
  }

  private sliceOf(node: PrismNode): string {
    return substringFromByteOffset(this.source, node.location.startOffset, node.location.length)
  }

  private locationOf(node: PrismNode): Location {
    return locationFromByteOffset(this.source, node.location.startOffset, node.location.length)
  }
}

const ACTION_HASH_VALUE = /\bherb_(?:set|toggle|increment|decrement|reset|into|name|by)(?::|\s*=>)\s*(["'])(?:(?!\1).)*\1/g

function withoutActionHashValues(expression: string): string {
  return expression.replace(ACTION_HASH_VALUE, "")
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

export class HerbStateValidReadsRule extends ParserRule {
  static ruleName = "herb-state-valid-reads"
  static introducedIn = this.version("unreleased")

  get parserOptions(): Partial<ParserOptions> {
    return {
      strict_locals: true,
      prism_nodes: true,
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

    const visitor = new StateValidReadsVisitor(this.ruleName, states, result.source, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
