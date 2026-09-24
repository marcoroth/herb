import { PrismVisitor, isPrismNodeType, locationFromByteOffset, stringIndexFromByteOffset, HTML_WHITESPACE_PRESERVING_ELEMENTS } from "@herb-tools/core"

import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"
import { ElementStackVisitor } from "../utils/rule-utils.js"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBContentNode, ERBNode, ERBIfNode, ERBUnlessNode, ERBElseNode, ERBWhenNode, ERBInNode, ERBRescueNode, ERBEnsureNode, ParserOptions, PrismNodes } from "@herb-tools/core"

const SILENT_OPENINGS = ["<%", "<%-"]
const OUTPUT_OPENINGS = ["<%=", "<%=="]

const SEPARATOR = /^[\s;]*;[\s;]*$/
const SEPARATORS_ONLY = /^[\s;]*$/
const WHITESPACE_ONLY = /^\s*$/

const DEFINITIONS = [
  "DefNode",
  "ClassNode",
  "ModuleNode",
  "SingletonClassNode",
  "AliasMethodNode",
  "AliasGlobalVariableNode",
  "UndefNode",
] as const

type StatementsScope = {
  depth: number
  statements: PrismNodes.Node[]
}

type Split = {
  tagOpening: string
  content: string
}

interface MultipleStatementsAutofixContext extends BaseAutofixContext {
  node: ERBContentNode
  tagOpening: string
  content: string
  originalTagOpening: string
  originalContent: string
}

class StatementsCollector extends PrismVisitor {
  readonly scopes: StatementsScope[] = []

  private depth = 0

  override visitStatementsNode(node: PrismNodes.StatementsNode): void {
    this.scopes.push({ depth: this.depth, statements: node.body })

    this.depth++
    this.visitChildNodes(node)
    this.depth--
  }
}

class NoMultipleStatementsVisitor extends ElementStackVisitor<MultipleStatementsAutofixContext> {
  private readonly scopes: StatementsScope[]
  private readonly source: string

  constructor(ruleName: string, context: Partial<LintContext> | undefined, scopes: StatementsScope[], source: string) {
    super(ruleName, context)

    this.scopes = scopes
    this.source = source
  }

  visitERBIfNode(node: ERBIfNode): void {
    this.checkControlFlowTag(node)
    this.visitChildNodes(node)
  }

  visitERBUnlessNode(node: ERBUnlessNode): void {
    this.checkControlFlowTag(node)
    this.visitChildNodes(node)
  }

  visitERBElseNode(node: ERBElseNode): void {
    this.checkControlFlowTag(node)
    this.visitChildNodes(node)
  }

  visitERBWhenNode(node: ERBWhenNode): void {
    this.checkControlFlowTag(node)
    this.visitChildNodes(node)
  }

  visitERBInNode(node: ERBInNode): void {
    this.checkControlFlowTag(node)
    this.visitChildNodes(node)
  }

  visitERBRescueNode(node: ERBRescueNode): void {
    this.checkControlFlowTag(node)
    this.visitChildNodes(node)
  }

  visitERBEnsureNode(node: ERBEnsureNode): void {
    this.checkControlFlowTag(node)
    this.visitChildNodes(node)
  }

  private checkControlFlowTag(node: ERBNode): void {
    if (!node.tag_opening || !node.tag_closing) return

    const contentRange = node.content?.range

    if (!contentRange) return

    const statements = this.shallowestStatementsIn(contentRange.from, contentRange.to).filter(statement => {
      return statement.location.startOffset + statement.location.length <= contentRange.to
    })

    if (statements.length === 0) return

    const autofixContext = this.autofixContextFor(node as ERBContentNode, statements, { keepPrefix: true })

    for (const statement of statements) {
      const { startOffset, length } = statement.location

      this.addOffense(
        `Avoid Ruby statements in a control-flow ERB tag. Move this statement into its own ERB tag for better readability.`,
        locationFromByteOffset(this.source, startOffset, length),
        autofixContext,
      )
    }
  }

  visitERBContentNode(node: ERBContentNode): void {
    if (node.location.start.line !== node.location.end.line) return

    const contentRange = node.content?.range

    if (!contentRange) return

    const statements = this.shallowestStatementsIn(contentRange.from, contentRange.to)

    if (statements.length <= 1) return

    const autofixContext = this.autofixContextFor(node, statements)

    for (const statement of statements.slice(1)) {
      const { startOffset, length } = statement.location

      this.addOffense(
        `Avoid multiple Ruby statements in a single-line ERB tag. Move this statement into its own ERB tag for better readability.`,
        locationFromByteOffset(this.source, startOffset, length),
        autofixContext,
      )
    }
  }

  private autofixContextFor(node: ERBContentNode, statements: PrismNodes.Node[], options: { keepPrefix?: boolean } = {}): MultipleStatementsAutofixContext | undefined {
    const tagOpening = node.tag_opening?.value

    if (!tagOpening) return undefined
    if (!SILENT_OPENINGS.includes(tagOpening) && !OUTPUT_OPENINGS.includes(tagOpening)) return undefined
    if (statements.some(statement => DEFINITIONS.some(definition => isPrismNodeType(statement, definition)))) return undefined

    const split = this.split(node, statements, tagOpening, options.keepPrefix === true)

    if (!split) return undefined

    return {
      node,
      ...split,
      originalTagOpening: tagOpening,
      originalContent: node.content!.value,
      unsafe: this.isInsideElement(...HTML_WHITESPACE_PRESERVING_ELEMENTS) || undefined,
    }
  }

  private split(node: ERBContentNode, statements: PrismNodes.Node[], tagOpening: string, keepPrefix: boolean): Split | null {
    const content = node.content!.value
    const contentStart = this.stringIndex(node.content!.range.from)
    const isOutput = OUTPUT_OPENINGS.includes(tagOpening)
    const indentation = this.standaloneIndentationFor(node)

    const pieces: string[] = []
    const boundary = (opening: string) => indentation === null ? ` %>${opening} ` : ` %>\n${indentation}${opening} `

    let cursor = 0

    if (keepPrefix) {
      const start = this.stringIndex(statements[0].location.startOffset) - contentStart
      const prefix = content.slice(0, start)

      const keyword = prefix.trimEnd().replace(/;+$/, "").trimEnd()

      if (WHITESPACE_ONLY.test(keyword)) return null

      pieces.push(keyword)
      pieces.push(boundary("<%"))

      cursor = start
    }

    for (const [index, statement] of statements.entries()) {
      const start = this.stringIndex(statement.location.startOffset) - contentStart
      const end = this.stringIndex(statement.location.startOffset + statement.location.length) - contentStart

      if (index > 0) {
        if (!SEPARATOR.test(content.slice(cursor, start))) return null

        pieces.push(boundary(index === statements.length - 1 && isOutput ? tagOpening : "<%"))
      }

      pieces.push(content.slice(index === 0 && !keepPrefix ? 0 : start, end))

      cursor = end
    }

    const trailing = content.slice(cursor)

    if (!SEPARATORS_ONLY.test(trailing)) return null

    pieces.push(trailing)

    return {
      tagOpening: isOutput ? "<%" : tagOpening,
      content: pieces.join(""),
    }
  }

  private standaloneIndentationFor(node: ERBContentNode): string | null {
    const start = node.tag_opening?.location.start ?? node.location.start
    const end = node.tag_closing?.location.end ?? node.location.end

    const lines = this.source.split("\n")
    const startLine = lines[start.line - 1]
    const endLine = lines[end.line - 1]

    if (startLine === undefined || endLine === undefined) return null

    const before = startLine.slice(0, start.column)
    const after = endLine.slice(end.column)

    if (!WHITESPACE_ONLY.test(before) || !WHITESPACE_ONLY.test(after)) return null

    return before
  }

  private stringIndex(byteOffset: number): number {
    return stringIndexFromByteOffset(this.source, byteOffset)
  }

  private shallowestStatementsIn(from: number, to: number): PrismNodes.Node[] {
    let shallowestDepth = Infinity
    let statements: PrismNodes.Node[] = []

    for (const scope of this.scopes) {
      if (scope.depth > shallowestDepth) continue

      const inRange = scope.statements.filter(statement => {
        const statementOffset = statement.location.startOffset

        return statementOffset >= from && statementOffset < to
      })

      if (inRange.length === 0) continue

      if (scope.depth < shallowestDepth) {
        shallowestDepth = scope.depth
        statements = inRange
      } else {
        statements = statements.concat(inRange)
      }
    }

    return statements.sort((left, right) => left.location.startOffset - right.location.startOffset)
  }
}

export class ERBNoMultipleStatementsRule extends ParserRule<MultipleStatementsAutofixContext> {
  static ruleName = "erb-no-multiple-statements"
  static introducedIn = this.version("0.11.0")
  static defaultEnabledIn = this.version("0.11.0")
  static autocorrectable = true
  static autofixRequiresContext = true

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_program: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<MultipleStatementsAutofixContext>[] {
    const program = result.value.prismNode
    const source = result.value.source

    if (!program || !source) return []

    const collector = new StatementsCollector()

    collector.visit(program)

    if (collector.scopes.length === 0) return []

    const visitor = new NoMultipleStatementsVisitor(this.ruleName, context, collector.scopes, source)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<MultipleStatementsAutofixContext>, result: ParseResult, _context?: Partial<LintContext>): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node, tagOpening, content, originalTagOpening, originalContent } = offense.autofixContext
    const erbNode = node as Mutable<ERBContentNode>

    if (!erbNode.tag_opening || !erbNode.content) return null

    if (erbNode.tag_opening.value === tagOpening && erbNode.content.value === content) return result
    if (erbNode.tag_opening.value !== originalTagOpening || erbNode.content.value !== originalContent) return null

    erbNode.tag_opening.value = tagOpening
    erbNode.content.value = content

    return result
  }
}
