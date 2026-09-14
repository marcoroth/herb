import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"
import { PrismVisitor, PrismNodes, deserializePrismParseResult, isERBCommentNode, substringFromByteOffset } from "@herb-tools/core"

import type { ERBNode, HTMLConditionalOpenTagNode, HTMLOpenTagNode, ParseResult, ParserOptions } from "@herb-tools/core"
import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"

interface ClosingErbTagIndentAutofixContext extends BaseAutofixContext {
  node: Mutable<ERBNode>
  fixType: "collapse" | "remove-newline" | "add-newline" | "fix-indent"
  expectedIndent: number
}

type StringLikeNode = PrismNodes.StringNode | PrismNodes.InterpolatedStringNode | PrismNodes.XStringNode | PrismNodes.InterpolatedXStringNode

const ERB_BLOCK_COMMENT_DELIMITER = /\n=(begin|end)\b/
const LEADING_LINE_COMMENT = /(?:^|\n)[ \t]*#/

class HeredocDetector extends PrismVisitor {
  public found = false

  constructor(private readonly source: string) {
    super()
  }

  visitStringNode(node: PrismNodes.StringNode): void {
    this.visitStringLikeNode(node)
  }

  visitInterpolatedStringNode(node: PrismNodes.InterpolatedStringNode): void {
    this.visitStringLikeNode(node)
  }

  visitXStringNode(node: PrismNodes.XStringNode): void {
    this.visitStringLikeNode(node)
  }

  visitInterpolatedXStringNode(node: PrismNodes.InterpolatedXStringNode): void {
    this.visitStringLikeNode(node)
  }

  private visitStringLikeNode(node: StringLikeNode): void {
    const opening = node.openingLoc

    if (opening && substringFromByteOffset(this.source, opening.startOffset, opening.length).startsWith("<<")) {
      this.found = true
      return
    }

    this.visitChildNodes(node)
  }
}

class ClosingErbTagIndentVisitor extends BaseRuleVisitor<ClosingErbTagIndentAutofixContext> {
  private openTagDepth = 0

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.openTagDepth += 1

    super.visitHTMLOpenTagNode(node)

    this.openTagDepth -= 1
  }

  visitHTMLConditionalOpenTagNode(node: HTMLConditionalOpenTagNode): void {
    this.openTagDepth += 1

    super.visitHTMLConditionalOpenTagNode(node)

    this.openTagDepth -= 1
  }

  visitERBNode(node: ERBNode): void {
    if (this.openTagDepth > 0) return
    if (isERBCommentNode(node)) return

    const openTag = node.tag_opening
    const closeTag = node.tag_closing
    const content = node.content

    if (!openTag || !closeTag || !content) return
    if (this.trimsWhitespace(openTag.value, closeTag.value)) return

    const value = content.value

    if (!value.trim()) return
    if (ERB_BLOCK_COMMENT_DELIMITER.test(value)) return
    if (this.carriesRubyComment(node, value)) return

    const leadingNewline = this.leadingNewlineIndex(value)
    const trailingNewline = this.trailingNewlineIndex(value)
    const body = value.slice(leadingNewline + 1, trailingNewline === -1 ? value.length : trailingNewline)

    const startsOnOwnLine = leadingNewline !== -1
    const endsOnOwnLine = trailingNewline !== -1
    const endsWithHeredoc = this.containsHeredoc(node)

    if (!body.includes("\n")) {
      if (!startsOnOwnLine && !endsOnOwnLine) return

      this.addOffense(
        `Put the tag on one line as \`${openTag.value} ... ${closeTag.value}\`. It holds a single line of Ruby, so the newlines inside it make it read as a multi-line block.`,
        closeTag.location,
        { node, fixType: "collapse", expectedIndent: 0 }
      )

      return
    }

    if (!startsOnOwnLine && !endsWithHeredoc) {
      if (!endsOnOwnLine) return

      this.addOffense(
        `Move \`${closeTag.value}\` up to the end of the last line of code. The opening \`${openTag.value}\` shares its line with code, so a closing tag alone on a line adds a line that carries nothing.`,
        closeTag.location,
        { node, fixType: "remove-newline", expectedIndent: 0 }
      )

      return
    }

    const expectedIndent = openTag.location.start.column

    if (!endsOnOwnLine) {
      if (endsWithHeredoc) return

      this.addOffense(
        `Move \`${closeTag.value}\` onto its own line, lined up with the opening \`${openTag.value}\`. The opening tag stands on its own line, so a closing tag at the end of the code hides where the tag ends.`,
        closeTag.location,
        { node, fixType: "add-newline", expectedIndent }
      )

      return
    }

    const actualIndent = value.length - trailingNewline - 1

    if (actualIndent === expectedIndent) return

    this.addOffense(
      `Indent \`${closeTag.value}\` to line up with the opening \`${openTag.value}\`. Expected ${expectedIndent} ${expectedIndent === 1 ? "space" : "spaces"} but found ${actualIndent}.`,
      closeTag.location,
      { node, fixType: "fix-indent", expectedIndent }
    )
  }

  private trimsWhitespace(openTag: string, closeTag: string): boolean {
    return openTag.endsWith("-") || closeTag.startsWith("-") || closeTag.startsWith("=")
  }

  private leadingNewlineIndex(value: string): number {
    for (let index = 0; index < value.length; index++) {
      const character = value[index]

      if (character === "\n") return index
      if (character !== " " && character !== "\t" && character !== "\r") return -1
    }

    return -1
  }

  private trailingNewlineIndex(value: string): number {
    for (let index = value.length - 1; index >= 0; index--) {
      const character = value[index]

      if (character === "\n") return index
      if (character !== " " && character !== "\t" && character !== "\r") return -1
    }

    return -1
  }

  private carriesRubyComment(node: ERBNode, value: string): boolean {
    if (LEADING_LINE_COMMENT.test(value)) return true
    if (!("prism_node" in node)) return false

    const bytes = node.prism_node
    const source = node.source

    if (!bytes || !source) return false

    try {
      return deserializePrismParseResult(bytes, source).comments.length > 0
    } catch {
      return false
    }
  }

  private containsHeredoc(node: ERBNode): boolean {
    if (!("prismNode" in node)) return false

    const prismNode = node.prismNode
    const source = node.source

    if (!prismNode || !source) return false

    const detector = new HeredocDetector(source)

    detector.visit(prismNode)

    return detector.found
  }
}

export class ERBClosingTagIndentRule extends ParserRule<ClosingErbTagIndentAutofixContext> {
  static autocorrectable = true
  static ruleName = "erb-closing-tag-indent"
  static introducedIn = this.version("unreleased")
  static defaultEnabledIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: {
        cli: "error",
        editor: "info",
      }
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_nodes: true
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<ClosingErbTagIndentAutofixContext>[] {
    const visitor = new ClosingErbTagIndentVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<ClosingErbTagIndentAutofixContext>, result: ParseResult, _context?: Partial<LintContext>): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node, fixType, expectedIndent } = offense.autofixContext

    if (!node.content) return null

    const content = node.content.value

    switch (fixType) {
      case "collapse": {
        node.content.value = ` ${content.trim()} `

        return result
      }

      case "add-newline": {
        const trimmed = content.trimEnd()

        node.content.value = trimmed + "\n" + " ".repeat(expectedIndent)

        return result
      }

      case "remove-newline": {
        const lastNewlineIndex = content.lastIndexOf("\n")

        if (lastNewlineIndex === -1) return null

        const beforeNewline = content.substring(0, lastNewlineIndex).trimEnd()

        node.content.value = beforeNewline + " "

        return result
      }

      case "fix-indent": {
        const lastNewlineIndex = content.lastIndexOf("\n")

        if (lastNewlineIndex === -1) return null

        node.content.value = content.substring(0, lastNewlineIndex + 1) + " ".repeat(expectedIndent)

        return result
      }
    }
  }
}
