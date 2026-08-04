import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

import { isRubyLiteralNode, isRubyParameterNode, isPrismNodeType, substringFromByteOffset } from "@herb-tools/core"

import type { ERBBlockNode, Node, ParseResult, ParserOptions, PrismNode, RubyParameterNode } from "@herb-tools/core"
import type { FullRuleConfig, LintContext, UnboundLintOffense } from "../types.js"

const IGNORED_PREFIX = "_"
const REPORTED_KINDS = ["positional", "rest"]
const MAXIMUM_TAG_SUGGESTION_LENGTH = 60

class NoUnusedBlockArgumentVisitor extends BaseRuleVisitor {
  visitERBBlockNode(node: ERBBlockNode): void {
    this.checkBlockArguments(node)

    this.visitChildNodes(node)
  }

  private checkBlockArguments(node: ERBBlockNode): void {
    const parameters = node.block_arguments.filter(isRubyParameterNode)
    if (parameters.length === 0) return

    const source = this.rubySourceInBody(node)
    const reported = parameters.filter(parameter => REPORTED_KINDS.includes(parameter.kind))

    const removable = reported.length > 0 && reported.every(parameter => this.isUnused(source, parameter))
    const removal = removable ? this.removalSuggestion(node, reported.length === parameters.length) : null
    const indexArgument = removable ? null : this.eachWithIndexArgumentName(node)

    for (const parameter of parameters) {
      const name = parameter.name?.value

      if (!name) continue
      if (name.startsWith(IGNORED_PREFIX)) continue
      if (!REPORTED_KINDS.includes(parameter.kind)) continue
      if (this.referencesName(source, name)) continue

      const suggestion = removal ?? (name === indexArgument ? `Use \`each\` instead of \`each_with_index\`` : null)

      const advice = suggestion
        ? `${suggestion}, or prefix it with an underscore as \`_${name}\``
        : `Prefix it with an underscore as \`_${name}\``

      this.addOffense(
        `Block argument \`${name}\` is never used. ${advice} to show it is intentionally unused.`,
        parameter.location,
        undefined,
        undefined,
        ["unnecessary"],
      )
    }
  }

  private isUnused(source: string, parameter: RubyParameterNode): boolean {
    const name = parameter.name?.value

    if (!name) return true

    return !this.referencesName(source, name)
  }

  private removalSuggestion(node: ERBBlockNode, dropsEveryArgument: boolean): string {
    const tag = dropsEveryArgument ? this.tagWithoutBlockArguments(node) : null

    if (tag && tag.length <= MAXIMUM_TAG_SUGGESTION_LENGTH) {
      return `Remove it and write \`${tag}\``
    }

    return `Remove it`
  }

  private tagWithoutBlockArguments(node: ERBBlockNode): string | null {
    const call = node.prismNode
    const source = node.source

    if (!source) return null
    if (!isPrismNodeType(call, "CallNode")) return null

    const opening = (call.block as PrismNode)?.parameters?.openingLoc
    if (!opening) return null

    const start = call.location.startOffset
    const length = opening.startOffset - start
    if (length <= 0) return null

    const header = this.callHeader(source, call, start, length).trim()

    if (header.includes("\n")) return null
    if (!header.endsWith("do")) return null

    const tagOpening = node.tag_opening?.value ?? "<%"
    const tagClosing = node.tag_closing?.value ?? "%>"

    return `${tagOpening} ${header} ${tagClosing}`
  }

  private callHeader(source: string, call: PrismNode, start: number, length: number): string {
    const message = call.messageLoc

    if (call.name === "each_with_index" && !call.arguments_ && message) {
      const messageEnd = message.startOffset + message.length

      const before = substringFromByteOffset(source, start, message.startOffset - start)
      const after = substringFromByteOffset(source, messageEnd, start + length - messageEnd)

      return `${before}each${after}`
    }

    return substringFromByteOffset(source, start, length)
  }

  private eachWithIndexArgumentName(node: ERBBlockNode): string | null {
    const parameters = this.plainBlockParameters(node, "each_with_index")

    if (!parameters) return null
    if (parameters.requireds.length !== 2) return null

    const index = parameters.requireds[1]
    if (!isPrismNodeType(index, "RequiredParameterNode")) return null

    return index.name
  }

  private plainBlockParameters(node: ERBBlockNode, method: string): PrismNode | null {
    const call = node.prismNode

    if (!isPrismNodeType(call, "CallNode")) return null
    if (call.name !== method) return null
    if (call.arguments_) return null

    const parameters = (call.block as PrismNode)?.parameters?.parameters
    if (!isPrismNodeType(parameters, "ParametersNode")) return null

    if (parameters.optionals.length > 0) return null
    if (parameters.posts.length > 0) return null
    if (parameters.keywords.length > 0) return null
    if (parameters.rest || parameters.keywordRest || parameters.block) return null

    return parameters
  }

  private rubySourceInBody(node: ERBBlockNode): string {
    const sources: string[] = []

    const collect = (current: Node | null | undefined): void => {
      if (!current) return

      if (isRubyLiteralNode(current)) {
        sources.push(current.content)
      } else if (current.type.startsWith("AST_ERB_")) {
        const content = (current as { content?: unknown }).content

        if (content && typeof content === "object" && "value" in content) {
          sources.push(String((content as { value?: unknown }).value ?? ""))
        }
      }

      current.compactChildNodes().forEach(collect)
    }

    node.body.forEach(collect)

    node.rescue_clause && collect(node.rescue_clause)
    node.else_clause && collect(node.else_clause)
    node.ensure_clause && collect(node.ensure_clause)

    return sources.join("\n")
  }

  private referencesName(source: string, name: string): boolean {
    return new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`).test(source)
  }
}

export class ERBNoUnusedBlockArgumentRule extends ParserRule {
  static ruleName = "erb-no-unused-block-argument"
  static introducedIn = this.version("unreleased")

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
      prism_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoUnusedBlockArgumentVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
