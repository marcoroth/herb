import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"

import type { BaseAutofixContext, Mutable, UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBContentNode, HerbStateDirectiveNode, HerbStateNonCanonicalDirectiveError, HerbError } from "@herb-tools/core"

const NON_CANONICAL_ERROR = "HERB_STATE_NON_CANONICAL_DIRECTIVE_ERROR"

const CANONICAL_TAG_OPENING = "<%#"
const CANONICAL_TAG_CLOSING = "%>"

type StateDirectiveNode = ERBContentNode | HerbStateDirectiveNode

interface HerbStateDirectiveSyntaxAutofixContext extends BaseAutofixContext {
  node: Mutable<StateDirectiveNode>
  expected: string
}

function nonCanonicalError(node: HerbStateDirectiveNode): HerbStateNonCanonicalDirectiveError | undefined {
  const error = node.errors.find((candidate: HerbError) => candidate.type === NON_CANONICAL_ERROR)

  return error as HerbStateNonCanonicalDirectiveError | undefined
}

function contentOf(expected: string): string | null {
  if (!expected.startsWith(CANONICAL_TAG_OPENING)) return null
  if (!expected.endsWith(CANONICAL_TAG_CLOSING)) return null

  return expected.slice(CANONICAL_TAG_OPENING.length, expected.length - CANONICAL_TAG_CLOSING.length)
}

function applyFix(node: Mutable<StateDirectiveNode>, expected: string): boolean {
  if (!node.tag_opening) return false
  if (!node.content) return false
  if (!node.tag_closing) return false

  const content = contentOf(expected)

  if (content === null) return false

  const unchanged =
    node.tag_opening.value === CANONICAL_TAG_OPENING &&
    node.content.value === content &&
    node.tag_closing.value === CANONICAL_TAG_CLOSING

  if (unchanged) return false

  node.tag_opening.value = CANONICAL_TAG_OPENING
  node.content.value = content
  node.tag_closing.value = CANONICAL_TAG_CLOSING

  return true
}

class HerbStateDirectiveSyntaxVisitor extends BaseRuleVisitor<HerbStateDirectiveSyntaxAutofixContext> {
  visitHerbStateDirectiveNode(node: HerbStateDirectiveNode): void {
    const error = nonCanonicalError(node)

    if (!error) return
    if (contentOf(error.expected) === null) return

    this.addOffense(
      `The \`herb:state\` directive has to be spelled \`${error.expected}\`. Write it on one line as \`<%# herb:state (...) %>\`, with a single space in each gap, so the states it declares are read the same way everywhere.`,
      error.location,
      {
        node: node as Mutable<StateDirectiveNode>,
        nodeType: "AST_ERB_CONTENT_NODE",
        expected: error.expected,
      },
    )
  }
}

export class HerbStateDirectiveSyntaxRule extends ParserRule<HerbStateDirectiveSyntaxAutofixContext> {
  static autocorrectable = true
  static autofixRequiresContext = true
  static consumesParserErrors = true
  static ruleName = "herb-state-directive-syntax"
  static introducedIn = this.version("unreleased")

  get parserOptions() {
    return {
      herb_directives: true,
    }
  }

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<HerbStateDirectiveSyntaxAutofixContext>[] {
    const visitor = new HerbStateDirectiveSyntaxVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<HerbStateDirectiveSyntaxAutofixContext>, result: ParseResult): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node, expected } = offense.autofixContext

    return applyFix(node, expected) ? result : null
  }
}
