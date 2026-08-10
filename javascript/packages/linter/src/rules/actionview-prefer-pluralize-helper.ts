import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import {
  isERBContentNode,
  isERBOutputNode,
  isHTMLTextNode,
  isLiteralNode,
  isPrismNodeType,
  locationFromByteOffset,
  substringFromByteOffset,
} from "@herb-tools/core"

import type {
  ERBContentNode,
  Node,
  ParseResult,
  ParserOptions,
  PrismNode,
} from "@herb-tools/core"
import type {
  UnboundLintOffense,
  LintContext,
  FullRuleConfig,
} from "../types.js"

const COUNT_METHODS = new Set(["length", "size", "count"])
const SIBLING_KEYS = ["children", "body", "statements"] as const
const PRISM_NEWLINE_FLAG = 1

interface PrismLocation {
  startOffset: number
  length: number
}

function singleExpression(node: PrismNode | null): PrismNode | null {
  if (!node) return null

  if (isPrismNodeType(node, "ProgramNode")) {
    const body = node.statements?.body
    return Array.isArray(body) && body.length === 1 ? body[0] : null
  }

  if (isPrismNodeType(node, "StatementsNode")) {
    return node.body.length === 1 ? node.body[0] : null
  }

  return node
}

function countExpression(node: ERBContentNode): PrismNode | null {
  const expression = singleExpression(node.prismNode)

  if (!isPrismNodeType(expression, "CallNode")) return null
  if (!expression.receiver || !COUNT_METHODS.has(expression.name)) return null

  return expression
}

function stringPluralizeCall(node: ERBContentNode): PrismNode | null {
  const expression = singleExpression(node.prismNode)

  if (!isPrismNodeType(expression, "CallNode")) return null
  if (expression.name !== "pluralize") return null
  if (
    !isPrismNodeType(expression.receiver, "StringNode") &&
    !isPrismNodeType(expression.receiver, "InterpolatedStringNode")
  ) {
    return null
  }

  const args = expression.arguments_?.arguments_
  if (!Array.isArray(args) || args.length !== 1) return null

  return expression
}

function prismFingerprint(node: PrismNode): string {
  return JSON.stringify(node, (key, value) => {
    if (key === "location" || key.endsWith("Loc")) return undefined

    if (key === "flags" && typeof value === "number") {
      return value & ~PRISM_NEWLINE_FLAG
    }

    return value
  })
}

function staticText(node: Node): string | null {
  if (isLiteralNode(node) || isHTMLTextNode(node)) return node.content ?? ""

  return null
}

function siblingLists(node: Node): Node[][] {
  const record = node as unknown as Record<string, unknown>

  return SIBLING_KEYS.map((key) => record[key]).filter((value): value is Node[] => Array.isArray(value))
}

function openingLocation(node: PrismNode): PrismLocation | null {
  return node.openingLoc ?? null
}

function escapeForQuote(text: string, quote: string): string {
  const escaped = text.split("\\").join("\\\\").split(quote).join(`\\${quote}`)

  return quote === `"` ? escaped.replace(/#(?=[{$@])/g, "\\#") : escaped
}

class ActionViewPreferPluralizeHelperVisitor extends BaseRuleVisitor {
  constructor(
    ruleName: string,
    context: Partial<LintContext> | undefined,
    private readonly source: string,
  ) {
    super(ruleName, context)
  }

  visitNode(node: Node): void {
    siblingLists(node).forEach((nodes) => this.checkSiblings(nodes))
  }

  private checkSiblings(nodes: Node[]): void {
    for (let index = 0; index < nodes.length; index++) {
      const firstERB = nodes[index]
      if (!isERBContentNode(firstERB) || !isERBOutputNode(firstERB)) continue

      const count = countExpression(firstERB)
      if (!count) continue

      let nextIndex = index + 1
      let interveningText = ""

      while (nextIndex < nodes.length) {
        const text = staticText(nodes[nextIndex])
        if (text === null) break

        interveningText += text
        nextIndex++
      }

      const secondERB = nodes[nextIndex]
      if (!isERBContentNode(secondERB) || !isERBOutputNode(secondERB)) continue

      const pluralize = stringPluralizeCall(secondERB)
      if (!pluralize) continue

      const pluralizeCount = pluralize.arguments_.arguments_[0]
      if (prismFingerprint(count) !== prismFingerprint(pluralizeCount)) continue

      this.addPluralizeOffense(count, pluralize, interveningText)
    }
  }

  private slice(node: PrismNode): string {
    return substringFromByteOffset(
      this.source,
      node.location.startOffset,
      node.location.length,
    )
  }

  private singularFor(receiver: PrismNode, interveningText: string): string | null {
    const text = interveningText.replace(/\s+/g, " ").replace(/^ /, "")
    const receiverSource = this.slice(receiver)

    if (!text) return receiverSource

    const opening = openingLocation(receiver)

    if (!opening || opening.startOffset !== receiver.location.startOffset) return null

    const quote = substringFromByteOffset(
      this.source,
      opening.startOffset,
      opening.length,
    )
    if (quote !== `"` && quote !== `'`) return null

    return `${quote}${escapeForQuote(text, quote)}${receiverSource.slice(quote.length)}`
  }

  private addPluralizeOffense(count: PrismNode, pluralize: PrismNode, interveningText: string): void {
    const singular = this.singularFor(pluralize.receiver, interveningText)
    if (singular === null) return

    const suggestion = `pluralize(${this.slice(count)}, ${singular})`

    const location = locationFromByteOffset(
      this.source,
      pluralize.location.startOffset,
      pluralize.location.length,
    )

    this.addOffense(
      `Prefer the \`pluralize\` helper over separate count and \`String#pluralize\` output. Use \`<%= ${suggestion} %>\` instead.`,
      location,
    )
  }
}

export class ActionViewPreferPluralizeHelperRule extends ParserRule {
  static ruleName = "actionview-prefer-pluralize-helper"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_nodes: true,
      prism_program: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const source = result.value.source
    if (!source) return []

    const visitor = new ActionViewPreferPluralizeHelperVisitor(
      this.ruleName,
      context,
      source,
    )

    visitor.visit(result.value)

    return visitor.offenses
  }
}
