import { ParserRule, Mutable, BaseAutofixContext } from "../types.js"
import { BaseRuleVisitor, locationFromContentOffset } from "./rule-utils.js"
import { getTagLocalName, isValidCharacterReference } from "@herb-tools/core"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ParserOptions, HTMLTextNode, HTMLElementNode } from "@herb-tools/core"

interface UnescapedEntitiesAutofixContext extends BaseAutofixContext {
  node: Mutable<HTMLTextNode>
  character: string
  entity: string
}

const AMPERSAND_PATTERN = /&(?:#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*)?;?/g

interface UnescapedOccurrence {
  character: string
  entity: string
  offset: number
}

type FindFn = (value: string) => number[]

interface EntityCheck {
  character: string
  entity: string
  find: FindFn
}

function findAllIndexes(value: string, character: string): number[] {
  const indexes: number[] = []
  let index = value.indexOf(character)

  while (index !== -1) {
    indexes.push(index)
    index = value.indexOf(character, index + 1)
  }

  return indexes
}

function findBareAmpersandIndexes(value: string): number[] {
  const indexes: number[] = []
  const pattern = new RegExp(AMPERSAND_PATTERN.source, "g")
  let match: RegExpExecArray | null

  while ((match = pattern.exec(value)) !== null) {
    if (!isValidCharacterReference(match[0])) {
      indexes.push(match.index)
    }
  }

  return indexes
}

const ENTITY_CHECKS: EntityCheck[] = [
  { character: "<", entity: "&lt;", find: (value) => findAllIndexes(value, "<") },
  { character: ">", entity: "&gt;", find: (value) => findAllIndexes(value, ">") },
  { character: "&", entity: "&amp;", find: findBareAmpersandIndexes },
]

function findUnescapedOccurrences(value: string): UnescapedOccurrence[] {
  const occurrences: UnescapedOccurrence[] = []

  for (const entry of ENTITY_CHECKS) {
    for (const offset of entry.find(value)) {
      occurrences.push({ character: entry.character, entity: entry.entity, offset })
    }
  }

  return occurrences
}

const RAW_TEXT_ELEMENTS = new Set(["script", "style"])

// Per the HTML5 spec (§13.2.5.36, §13.2.5.37), no characters are parse errors
// in quoted attribute values. Entity checks only apply to text content.
interface ElementStackEntry {
  tagName: string
  hasAutoEscapedContent: boolean
}

const VIRTUAL_CLOSE_TAG_TYPE = "AST_HTML_VIRTUAL_CLOSE_TAG_NODE"

class HTMLNoUnescapedEntitiesVisitor extends BaseRuleVisitor<UnescapedEntitiesAutofixContext> {
  private elementStack: ElementStackEntry[] = []

  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)

    if (tagName) {
      // ActionView tag helpers auto-escape their string argument content.
      // We detect this by checking two conditions:
      // 1. The element was created by an ActionView helper (element_source !== "HTML")
      // 2. The element has a virtual close tag (not an ERB end node), meaning the
      //    content came from a string argument rather than a block body.
      //
      // Block bodies (e.g. `<%= link_to "#" do %>Tom & Jerry<% end %>`) contain
      // literal template HTML that is NOT auto-escaped, so those must still be checked.
      const isActionViewHelper = !!node.element_source && node.element_source !== "HTML"
      const hasVirtualCloseTag = node.close_tag?.type === VIRTUAL_CLOSE_TAG_TYPE
      const hasAutoEscapedContent = isActionViewHelper && hasVirtualCloseTag

      this.elementStack.push({ tagName, hasAutoEscapedContent })
    }

    super.visitHTMLElementNode(node)

    if (tagName) {
      this.elementStack.pop()
    }
  }

  private get insideRawTextElement(): boolean {
    return this.elementStack.some((entry) => RAW_TEXT_ELEMENTS.has(entry.tagName))
  }

  private get insideAutoEscapedHelper(): boolean {
    const current = this.elementStack.at(-1)
    return !!current?.hasAutoEscapedContent
  }

  visitHTMLTextNode(node: HTMLTextNode): void {
    if (this.insideRawTextElement || this.insideAutoEscapedHelper) {
      super.visitHTMLTextNode(node)
      return
    }

    const content = node.content
    if (!content) return

    const occurrences = findUnescapedOccurrences(content)
    const startLine = node.location.start.line
    const startColumn = node.location.start.column

    for (const { character, entity, offset } of occurrences) {
      const location = locationFromContentOffset(startLine, startColumn, content, offset)

      this.addOffense(
        `Text content contains an unescaped \`${character}\` character. Use \`${entity}\` instead.`,
        location,
        { node, character, entity, unsafe: true },
      )
    }

    super.visitHTMLTextNode(node)
  }
}

export class HTMLNoUnescapedEntitiesRule extends ParserRule<UnescapedEntitiesAutofixContext> {
  static ruleName = "html-no-unescaped-entities"
  static introducedIn = this.version("0.9.3")
  static unsafeAutocorrectable = true

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<UnescapedEntitiesAutofixContext>[] {
    const visitor = new HTMLNoUnescapedEntitiesVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<UnescapedEntitiesAutofixContext>, result: ParseResult): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node } = offense.autofixContext

    node.content = node.content.replace(new RegExp(AMPERSAND_PATTERN.source, "g"), (match) => {
      if (isValidCharacterReference(match)) return match
      return "&amp;" + match.slice(1)
    })
    node.content = node.content.replaceAll("<", "&lt;")
    node.content = node.content.replaceAll(">", "&gt;")

    return result
  }
}
