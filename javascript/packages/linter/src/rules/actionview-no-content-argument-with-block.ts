import { ParserRule } from "../types.js"
import { PrismVisitor, getHelper, isPrismNodeType, isRubyIntrospectionMethod, substringFromByteOffset, locationFromByteOffset } from "@herb-tools/core"

import { isActionViewHelperCall, isTagBuilderCall } from "./action-view-utils.js"

import type { HelperEntry, ParseResult, ParserOptions, PrismNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

const HASH_ARGUMENT_TYPES = ["HashNode", "KeywordHashNode"] as const
const CONTENT_LITERAL_TYPES = ["StringNode", "InterpolatedStringNode", "SymbolNode", "InterpolatedSymbolNode", "IntegerNode", "FloatNode"] as const

interface ContentArgumentOffense {
  helper: HelperEntry
  helperCallName: string
  contentArgument: PrismNode
  ignoredArgument: PrismNode
  ignoredPosition: number
}

function isHashArgument(node: PrismNode): boolean {
  return HASH_ARGUMENT_TYPES.some(type => isPrismNodeType(node, type))
}

function isContentLiteral(node: PrismNode): boolean {
  return CONTENT_LITERAL_TYPES.some(type => isPrismNodeType(node, type))
}

function sourceOf(source: string, node: PrismNode): string {
  return substringFromByteOffset(source, node.location.startOffset, node.location.length)
}

function argumentName(helper: HelperEntry, position: number): string {
  return helper.arguments[position - 1]?.name ?? `argument ${position}`
}

function contentArgumentOffense(call: PrismNode): ContentArgumentOffense | null {
  const helperCall = isActionViewHelperCall(call)

  if (!helperCall) return null
  if (!isPrismNodeType(call.block, "BlockNode")) return null
  if (isTagBuilderCall(call) && isRubyIntrospectionMethod(call.name)) return null

  const helper = getHelper(helperCall.helperName)
  const content = helper?.content

  if (!helper || !content) return null
  if (content.source !== "block_or_arg") return null
  if (content.argPosition === null) return null
  if (content.positionalArgumentsWithBlock === null) return null

  const argumentNodes: PrismNode[] = call.arguments_?.arguments_ ?? []

  const contentArgument = argumentNodes[content.argPosition - 1]
  const ignoredArgument = argumentNodes[content.positionalArgumentsWithBlock]

  if (!contentArgument || !ignoredArgument) return null
  if (!isContentLiteral(contentArgument)) return null
  if (isHashArgument(ignoredArgument)) return null

  return {
    helper,
    helperCallName: call.receiver ? `${helper.name}.${call.name}` : helper.name,
    contentArgument,
    ignoredArgument,
    ignoredPosition: content.positionalArgumentsWithBlock + 1,
  }
}

class ContentArgumentWithBlockCollector extends PrismVisitor {
  public readonly offenses: ContentArgumentOffense[] = []

  visitCallNode(node: PrismNode): void {
    const offense = contentArgumentOffense(node)

    if (offense) {
      this.offenses.push(offense)
    }

    this.visitChildNodes(node)
  }
}

export class ActionViewNoContentArgumentWithBlockRule extends ParserRule {
  static ruleName = "actionview-no-content-argument-with-block"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_program: true,
    }
  }

  check(result: ParseResult, _context?: Partial<LintContext>): UnboundLintOffense[] {
    const source = result.value.source
    const prismNode = result.value.prismNode

    if (!prismNode || !source) return []

    const collector = new ContentArgumentWithBlockCollector()

    collector.visit(prismNode)

    return collector.offenses.map(({ helper, helperCallName, contentArgument, ignoredArgument, ignoredPosition }) => {
      const location = locationFromByteOffset(source, contentArgument.location.startOffset, contentArgument.location.length)
      const content = sourceOf(source, contentArgument)
      const shiftsArguments = contentArgument !== ignoredArgument

      if (shiftsArguments) {
        const shiftedInto = argumentName(helper, ignoredPosition)
        const shiftedAway = argumentName(helper, ignoredPosition + 1)

        return this.createOffense(
          `The \`${helperCallName}\` helper shifts its arguments when it is given a block, so \`${content}\` is read as \`${shiftedInto}\` and \`${sourceOf(source, ignoredArgument)}\` as \`${shiftedAway}\` instead of as content. Rails expects a Hash in \`${shiftedAway}\` and raises when it is not one. Remove \`${content}\` and let the block render the content.`,
          location,
        )
      }

      return this.createOffense(
        `The \`${helperCallName}\` helper renders either its content argument or its block, never both, and the block wins, so \`${content}\` is silently discarded and never reaches the page. Remove \`${content}\`, or remove the block and let the argument render the content.`,
        location,
        undefined,
        undefined,
        ["unnecessary"],
      )
    })
  }
}
