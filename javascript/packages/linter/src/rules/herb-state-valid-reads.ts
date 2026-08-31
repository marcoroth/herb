import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { StateScopeMap } from "../utils/state-directives-utils.js"

import { COMPARISON_OPERATORS, FALSY_STATE_KINDS, PRISM_LITERAL_KINDS, STATE_PREDICATES, STATE_TRANSFORMS } from "@herb-tools/client/directives"

import { declaredKind, defaultExample, kindWithArticle, predicateAdvice } from "../utils/state-directives-utils.js"
import { bareReadName, classifyDerivedDefault, mentionsAnyState, predicateAnswers, transformApplies } from "@herb-tools/client/directives"
import { isBooleanAttribute, locationFromByteOffset, substringFromByteOffset } from "@herb-tools/core"
import { getAttributeName, getAttributeValueNodes, isERBContentNode } from "@herb-tools/core"

import type { StateDeclaration } from "@herb-tools/client/directives"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ParserOptions, Location, PrismNode, ERBBlockNode, ERBContentNode, ERBIfNode, ERBUnlessNode, ERBCaseNode, HTMLAttributeNode, RubyLiteralNode } from "@herb-tools/core"

interface BareRead {
  name: string
  predicate: boolean
}

interface PredicateCall {
  name: string
  predicate: string
}

interface TransformCall {
  name: string
  transform: string
}

type ReadContext = "branch" | "value"

function prismNegation(node: PrismNode | null | undefined): PrismNode | null {
  if (prismType(node) !== "CallNode") return null
  if (String(node.name) !== "!") return null
  if (!node.receiver || node.block) return null
  if (node.arguments_?.arguments_?.length) return null

  const inner = node.receiver

  return prismType(inner) === "ParenthesesNode" && inner.body?.body?.length === 1 ? inner.body.body[0] : inner
}

function prismTransformRead(node: PrismNode | null | undefined): TransformCall | null {
  if (prismType(node) !== "CallNode") return null
  if (!node.receiver || node.block) return null
  if (node.arguments_?.arguments_?.length) return null

  const transform = String(node.name)
  if (!(transform in STATE_TRANSFORMS)) return null

  const receiver = prismBareRead(node.receiver)
  if (!receiver || receiver.predicate) return null

  return { name: receiver.name, transform }
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

function prismPredicateRead(node: PrismNode | null | undefined): PredicateCall | null {
  if (prismType(node) !== "CallNode") return null
  if (!node.receiver || node.block) return null
  if (node.arguments_?.arguments_?.length) return null

  const predicate = String(node.name)

  if (!(predicate in STATE_PREDICATES)) {
    return null
  }

  const receiver = prismBareRead(node.receiver)

  if (!receiver || receiver.predicate) {
    return null
  }

  return { name: receiver.name, predicate }
}

function equalitySides(node: PrismNode): [PrismNode, PrismNode, string] | null {
  if (prismType(node) !== "CallNode") return null

  const operator = String(node.name)

  if (!COMPARISON_OPERATORS.has(operator)) return null
  if (!node.receiver) return null
  if (node.arguments_?.arguments_?.length !== 1) return null

  return [node.receiver, node.arguments_.arguments_[0], operator]
}

class StateValidReadsVisitor extends BaseRuleVisitor {
  private states: StateScopeMap
  private source: string
  private stack: (ERBBlockNode | null)[] = [null]
  private booleanAttribute = false
  private attributeName: string | null = null

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
    const previousName = this.attributeName

    this.booleanAttribute = name !== null && isBooleanAttribute(name)
    this.attributeName = name

    this.checkMixedInterpolation(node)

    super.visitHTMLAttributeNode(node)

    this.booleanAttribute = previous
    this.attributeName = previousName
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
      `\`${read}\` reads a state inside an interpolated attribute that mixes other dynamic parts. A state write cannot supply the other values. Give the state its own attribute, or its own output outside this one.`,
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

      if (this.checkPresenceRead(expression, node)) return

      if (prism) this.classifyPredicate(prism, names)

      return
    }

    const bare = bareReadName(expression)

    if (bare && this.resolve(bare)) return

    const prism = node.prismNode

    if (prism && this.classifyPredicate(prism, names, "value") !== "other") return

    const name = names.find(candidate => mentionsAnyState(expression, [candidate])) ?? names[0]

    this.addOffense(this.computedValueOffense(expression, name), node.location)
  }

  visitRubyLiteralNode(node: RubyLiteralNode): void {
    const names = this.states.namesIn(this.stack)
    if (names.length === 0) return

    const expression = (node.content ?? "").trim()
    if (expression === "" || !mentionsAnyState(expression, names)) return

    if (this.booleanAttribute) {
      const declared = new Map(names.map((name) => [name, declaredKind(this.resolve(name)!)]))

      if (classifyDerivedDefault(expression, declared) !== "mixed") return
    } else {
      const bare = bareReadName(expression)

      if (bare && this.resolve(bare)) return

      const declared = new Map(names.map((name) => [name, declaredKind(this.resolve(name)!)]))

      if (classifyDerivedDefault(expression, declared) !== "mixed") return
    }

    const name = names.find(candidate => mentionsAnyState(expression, [candidate])) ?? names[0]

    this.addOffense(this.computedValueOffense(expression, name), node.location)
  }

  visitERBUnlessNode(node: ERBUnlessNode): void {
    const prism = node.prismNode

    if (prismType(prism) === "UnlessNode" && prism.predicate) {
      const names = this.states.namesIn(this.stack)

      if (names.length > 0 && !this.checkNeverFalsy(prism.predicate, `unless ${this.sliceOf(prism.predicate)}`, "false")) {
        this.classifyPredicate(prism.predicate, names)
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

      if (this.checkNeverFalsy(predicate, this.sliceOf(predicate), "true")) return

      const read = this.classifyPredicate(predicate, names)
      if (read === "reported") return

      if (read === "state") {
        stateDriven = true
        current = current.subsequent

        continue
      }

      if (stateDriven) {
        this.addOffense(
          `\`${this.sliceOf(predicate)}\` sits in a state-driven conditional but reads no state. The client resolves every arm, so an arm it cannot answer would never be chosen. Read a state in this arm, or move this branch into its own conditional.`,
          this.locationOf(predicate),
        )
      }

      return
    }
  }

  private classifyPredicate(predicate: PrismNode, names: readonly string[], context: ReadContext = "branch"): "state" | "other" | "reported" {
    const type = prismType(predicate)

    if (type === "ParenthesesNode") {
      const statements = predicate.body?.body

      if (Array.isArray(statements) && statements.length === 1) {
        return this.classifyPredicate(statements[0], names, context)
      }
    }

    const negated = prismNegation(predicate)

    if (negated) {
      return this.classifyPredicate(negated, names, context)
    }

    if ((type === "AndNode" || type === "OrNode") && predicate.left && predicate.right) {
      const left = this.classifyPredicate(predicate.left, names, context)
      if (left === "reported") return "reported"

      const right = this.classifyPredicate(predicate.right, names, context)
      if (right === "reported") return "reported"
      if (left === "state" && right === "state") return "state"

      if (left === "state" || right === "state") {
        const server = left === "state" ? predicate.right : predicate.left
        const reader = left === "state" ? predicate.left : predicate.right
        const read = names.find(candidate => mentionsAnyState(this.sliceOf(reader), [candidate]))
        const reads = read ? `the state \`${read}\`` : "a state"
        const joiner = type === "AndNode" ? "&&" : "||"
        const offending = this.sliceOf(server)

        this.addOffense(
          `\`${offending}\` is server Ruby inside a condition that also reads ${reads}. The client resolves each side of \`${joiner}\` itself and has no value for this one. Move \`${offending}\` into its own conditional around this one, or declare a state for it and set it from app code.`,
          this.locationOf(server),
        )

        return "reported"
      }

      return "other"
    }

    const bare = prismBareRead(predicate)

    if (bare) {
      const declaration = this.resolve(bare.name)
      if (!declaration) return "other"

      return "state"
    }

    const transformCall = prismTransformRead(predicate)

    if (transformCall) {
      const declaration = this.resolve(transformCall.name)

      if (!declaration) return "other"

      const kind = declaredKind(declaration)

      if (!transformApplies(transformCall.transform, kind)) {
        this.addOffense(
          `\`${this.sliceOf(predicate)}\` reads the ${capitalize(kind)} state \`${transformCall.name}\` with \`${transformCall.transform}\`. Only ${STATE_TRANSFORMS[transformCall.transform].only} can be read with \`${transformCall.transform}\`. Compare \`${transformCall.name}\` itself instead${defaultExample(declaration, `${transformCall.name} == `)}.`,
          this.locationOf(predicate),
        )

        return "reported"
      }

      return "state"
    }

    const call = prismPredicateRead(predicate)

    if (call) {
      const declaration = this.resolve(call.name)
      if (!declaration) return "other"

      const kind = declaredKind(declaration)

      if (!predicateAnswers(call.predicate, kind)) {
        this.addOffense(
          `\`${this.sliceOf(predicate)}\` reads the ${capitalize(kind)} state \`${call.name}\` with \`${call.predicate}\`. Only ${STATE_PREDICATES[call.predicate].only} can be read with \`${call.predicate}\`. Compare \`${call.name}\` to a literal instead, or declare it as ${kindWithArticle(STATE_PREDICATES[call.predicate].kinds?.[0] ?? "seeded")} state.`,
          this.locationOf(predicate),
        )

        return "reported"
      }

      return "state"
    }

    const sides = equalitySides(predicate)

    if (sides) {
      const [left, right, operator] = sides

      const leftTransform = prismTransformRead(left)
      const rightTransform = prismTransformRead(right)

      for (const [side, call] of [[left, leftTransform], [right, rightTransform]] as [PrismNode, TransformCall | null][]) {
        if (!call) continue

        const declaration = this.resolve(call.name)

        if (!declaration) continue

        const kind = declaredKind(declaration)

        if (!transformApplies(call.transform, kind)) {
          this.addOffense(
            `\`${this.sliceOf(side)}\` reads the ${capitalize(kind)} state \`${call.name}\` with \`${call.transform}\`. Only ${STATE_TRANSFORMS[call.transform].only} can be read with \`${call.transform}\`. Compare \`${call.name}\` itself instead${defaultExample(declaration, `${call.name} == `)}.`,
            this.locationOf(side),
          )

          return "reported"
        }
      }

      if (leftTransform && rightTransform) {
        const leftReturns = STATE_TRANSFORMS[leftTransform.transform].returns
        const rightReturns = STATE_TRANSFORMS[rightTransform.transform].returns
        const ordered = operator !== "==" && operator !== "!="

        if (ordered && (leftReturns !== "integer" || rightReturns !== "integer")) {
          this.addOffense(
            `\`${this.sliceOf(predicate)}\` orders the ${leftTransform.transform} of the state \`${leftTransform.name}\` against the ${rightTransform.transform} of the state \`${rightTransform.name}\`. Ordering compares numbers. Make both sides Integers, or compare them with \`==\` instead.`,
            this.locationOf(predicate),
          )

          return "reported"
        }

        if (!ordered && leftReturns !== rightReturns) {
          this.addOffense(
            `\`${this.sliceOf(predicate)}\` compares the ${leftTransform.transform} of the state \`${leftTransform.name}\` with the ${rightTransform.transform} of the state \`${rightTransform.name}\`, so it can never match. Compare values of the same kind, or redeclare one of the two states.`,
            this.locationOf(predicate),
          )

          return "reported"
        }

        return "state"
      }

      const transformed = leftTransform ?? rightTransform

      if (transformed) {
        const returns = STATE_TRANSFORMS[transformed.transform].returns
        const other = leftTransform ? right : left
        const otherTransform = prismBareRead(other)
        const otherDeclaration = otherTransform ? this.resolve(otherTransform.name) : undefined

        if (otherDeclaration) {
          const otherKind = declaredKind(otherDeclaration)

          if (otherKind !== "seeded" && otherKind !== returns) {
            this.addOffense(
              `\`${this.sliceOf(predicate)}\` compares the ${transformed.transform} of the state \`${transformed.name}\` with the ${capitalize(otherKind)} state \`${otherTransform!.name}\`, so it can never match. Compare values of the same kind, or redeclare one of the two states.`,
              this.locationOf(predicate),
            )

            return "reported"
          }

          return "state"
        }

        const otherKind = PRISM_LITERAL_KINDS[prismType(other)]

        if (!otherKind) {
          this.addOffense(
            `\`${this.sliceOf(predicate)}\` compares the ${transformed.transform} of the state \`${transformed.name}\` against \`${this.sliceOf(other)}\`, which is not a literal. The client resolves a comparison by looking the state up, so it has no value for the other side. Compare it to a literal instead, or declare a state for \`${this.sliceOf(other)}\` and set it from app code.`,
            this.locationOf(predicate),
          )

          return "reported"
        }

        if (otherKind !== returns) {
          this.addOffense(
            `\`${this.sliceOf(predicate)}\` compares the ${transformed.transform} of the state \`${transformed.name}\` against ${kindWithArticle(otherKind)} literal, so it can never match. Compare it against ${kindWithArticle(returns)} literal instead.`,
            this.locationOf(predicate),
          )

          return "reported"
        }

        return "state"
      }

      const leftRead = prismBareRead(left)
      const rightRead = prismBareRead(right)
      const leftDeclaration = leftRead ? this.resolve(leftRead.name) : undefined
      const rightDeclaration = rightRead ? this.resolve(rightRead.name) : undefined

      if (leftDeclaration && rightDeclaration && leftRead && rightRead) {
        const leftKind = declaredKind(leftDeclaration)
        const rightKind = declaredKind(rightDeclaration)
        const ordered = operator !== "==" && operator !== "!="

        if (ordered && leftKind !== "seeded" && rightKind !== "seeded" && (leftKind !== "integer" || rightKind !== "integer")) {
          this.addOffense(
            `\`${this.sliceOf(predicate)}\` orders the ${capitalize(leftKind)} state \`${leftRead.name}\` against the ${capitalize(rightKind)} state \`${rightRead.name}\`. Ordering compares numbers. Make both sides Integers, or compare them with \`==\` instead.`,
            this.locationOf(predicate),
          )

          return "reported"
        }

        if (!ordered && leftKind !== "seeded" && rightKind !== "seeded" && leftKind !== rightKind) {
          this.addOffense(
            `\`${this.sliceOf(predicate)}\` compares the ${capitalize(leftKind)} state \`${leftRead.name}\` with the ${capitalize(rightKind)} state \`${rightRead.name}\`, so it can never match. Compare values of the same kind, or redeclare one of the two states.`,
            this.locationOf(predicate),
          )

          return "reported"
        }

        return "state"
      }

      const declaration = leftDeclaration || rightDeclaration || null

      if (declaration) {
        const comparand = leftDeclaration ? right : left
        const comparandKind = PRISM_LITERAL_KINDS[prismType(comparand)]
        const kind = declaredKind(declaration)

        if (!comparandKind) {
          const example = defaultExample(declaration, `${declaration.name} == `)

          this.addOffense(
            `\`${this.sliceOf(predicate)}\` compares the state \`${declaration.name}\` against \`${this.sliceOf(comparand)}\`, which is not a literal. The client resolves a comparison by looking the state up, so it has no value for the other side. Compare \`${declaration.name}\` to a literal${example}, or declare a state for \`${this.sliceOf(comparand)}\` and set it from app code.`,
            this.locationOf(predicate),
          )

          return "reported"
        }

        const ordered = operator !== "==" && operator !== "!="

        if (ordered && kind !== "seeded" && kind !== "integer") {
          this.addOffense(
            `\`${this.sliceOf(predicate)}\` orders the ${capitalize(kind)} state \`${declaration.name}\`. Ordering compares numbers. Declare \`${declaration.name}\` as an Integer, like \`(${declaration.name}: 0)\`, or compare it with \`==\` instead.`,
            this.locationOf(predicate),
          )

          return "reported"
        }

        if (ordered && comparandKind !== "integer") {
          this.addOffense(
            `\`${this.sliceOf(predicate)}\` orders the state \`${declaration.name}\` against ${kindWithArticle(comparandKind)} literal. Ordering compares numbers. Compare \`${declaration.name}\` against an Integer literal, like \`${declaration.name} > 0\`.`,
            this.locationOf(predicate),
          )

          return "reported"
        }

        if (!ordered && kind !== "seeded" && comparandKind !== "nil" && comparandKind !== kind) {
          const consequence = operator === "==" ? "so it can never match" : "so it always matches"

          this.addOffense(
            `\`${this.sliceOf(predicate)}\` compares the ${capitalize(kind)} state \`${declaration.name}\` against ${kindWithArticle(comparandKind)} literal, ${consequence}. Compare it against ${kindWithArticle(kind)} literal${defaultExample(declaration, `${declaration.name} == `)}.`,
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
        context === "value" ? this.computedValueOffense(this.sliceOf(predicate), name) : `\`${this.sliceOf(predicate)}\` computes with the state \`${name}\`. The client resolves each condition itself and cannot run Ruby to pick a branch. ${this.conditionAdvice(name)}`,
        this.locationOf(predicate),
      )

      return "reported"
    }

    return "other"
  }

  private checkNeverFalsy(predicate: PrismNode, spelled: string, answer: string): boolean {
    const bare = prismBareRead(predicate)
    const declaration = bare ? this.resolve(bare.name) : null

    if (!declaration) {
      return false
    }

    const kind = declaredKind(declaration)

    if (FALSY_STATE_KINDS.has(kind)) {
      return false
    }

    this.addOffense(
      `\`${spelled}\` reads the ${capitalize(kind)} state \`${bare!.name}\` as a presence. Only \`nil\` and \`false\` are falsy in Ruby, so the condition is always ${answer}. ${predicateAdvice(kind, bare!.name)}compare it to a literal${defaultExample(declaration, `${bare!.name} == `)}, or declare it as a boolean.`,
      this.locationOf(predicate),
    )

    return true
  }

  private checkPresenceRead(expression: string, node: ERBContentNode): boolean {
    const bare = bareReadName(expression)
    const declaration = bare ? this.resolve(bare) : null

    if (!declaration) return false

    const kind = declaredKind(declaration)

    if (FALSY_STATE_KINDS.has(kind)) return false

    this.addOffense(
      `\`${this.attributeName}="<%= ${expression} %>"\` reads the ${capitalize(kind)} state \`${bare}\` as a presence. Only \`nil\` and \`false\` are falsy in Ruby, so the attribute could never turn off. ${predicateAdvice(kind, bare!)}compare it to a literal${defaultExample(declaration, `${bare} == `)}, or declare it as a boolean.`,
      node.location,
    )

    return true
  }

  private computedValueOffense(expression: string, name: string): string {
    return `\`${expression}\` computes with the state \`${name}\`. The client cannot run Ruby to keep the result current. Show the value with \`<%= ${name} %>\`, or declare a second state for the computed answer and set it from app code.`
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
      const mentioned = bare?.name ?? names.find(candidate => mentionsAnyState(subjectText, [candidate]))
      const example = mentioned ? `, like \`case ${mentioned}\`` : ""

      this.addOffense(
        `\`case ${subjectText}\` switches on something other than a bare state read. The client resolves a \`case\` by looking the state up. Switch on the state itself${example}.`,
        this.locationOf(subject),
      )

      return
    }

    const kind = declaredKind(declaration)

    for (const when of prism.conditions ?? []) {
      if (prismType(when) !== "WhenNode") continue

      const list = (when.conditions ?? []).map((condition: PrismNode) => this.sliceOf(condition)).join(", ")

      for (const condition of when.conditions ?? []) {
        const comparandKind = PRISM_LITERAL_KINDS[prismType(condition)]

        if (!comparandKind) {
          this.addOffense(
            `\`when ${list}\` on the state \`${declaration.name}\` has a comparand that is not a literal. The client resolves a \`when\` by lookup. List literals instead${defaultExample(declaration, "when ")}.`,
            this.locationOf(condition),
          )

          break
        }

        if (kind !== "seeded" && comparandKind !== "nil" && comparandKind !== kind) {
          this.addOffense(
            `\`when ${list}\` compares the ${capitalize(kind)} state \`${declaration.name}\` against a literal of another type, so it can never match. Use ${kindWithArticle(kind)} literal in every arm${defaultExample(declaration, "when ")}.`,
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

    if (!declaration) return "Read the state bare, or compare it to a literal."

    if (kind === "boolean") {
      return `Read \`${name}\` bare, like \`<% if ${name} %>\`, or as \`${name}?\`.`
    }

    return `Read \`${name}\` bare, like \`<% if ${name} %>\`, or compare it to a literal${defaultExample(declaration, `${name} == `)}.`
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

    if (!states.hasDeclarations) return []

    const visitor = new StateValidReadsVisitor(this.ruleName, states, result.source, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
