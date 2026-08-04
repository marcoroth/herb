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
  DocumentNode,
  ERBContentNode,
  HTMLElementNode,
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
  if (!isPrismNodeType(expression.receiver, "StringNode")) return null

  const args = expression.arguments_?.arguments_
  if (!Array.isArray(args) || args.length === 0) return null

  return expression
}

function prismFingerprint(node: PrismNode): string {
  return JSON.stringify(node, (key, value) => {
    if (key === "location" || key.endsWith("Loc")) return undefined
    // Prism marks a call used as the value of a program differently from the
    // same call nested in an argument. That contextual flag is not semantic.
    if (key === "flags" && typeof value === "number") return value & ~1
    return value
  })
}

function staticText(node: Node): string | null {
  if (isLiteralNode(node) || isHTMLTextNode(node)) return node.content ?? ""
  return null
}

class ActionViewPreferPluralizeHelperVisitor extends BaseRuleVisitor {
  constructor(
    ruleName: string,
    context: Partial<LintContext> | undefined,
    private readonly source: string,
  ) {
    super(ruleName, context)
  }

  visitDocumentNode(node: DocumentNode): void {
    this.checkSiblings(node.children)
    this.visitChildNodes(node)
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    this.checkSiblings(node.body)
    this.visitChildNodes(node)
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

  private addPluralizeOffense(
    count: PrismNode,
    pluralize: PrismNode,
    interveningText: string,
  ): void {
    const slice = (node: PrismNode) =>
      substringFromByteOffset(
        this.source,
        node.location.startOffset,
        node.location.length,
      )

    let singular = slice(pluralize.receiver)
    const prefix = interveningText.trim()

    if (prefix) {
      const content = substringFromByteOffset(
        this.source,
        pluralize.receiver.contentLoc.startOffset,
        pluralize.receiver.contentLoc.length,
      )
      singular = JSON.stringify(`${prefix} ${content}`)
    }

    const suggestion = `pluralize(${slice(count)}, ${singular})`
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

  check(
    result: ParseResult,
    context?: Partial<LintContext>,
  ): UnboundLintOffense[] {
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
