import { PrismVisitor } from "@herb-tools/core"
import { ParserRule } from "../types.js"
import { locationFromOffset } from "./rule-utils.js"

import type { ParseResult, ParserOptions, PrismNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

interface ContentAndBlockOffense {
  helperName: string
  startOffset: number
  length: number
  contentArgStartOffset: number
  contentArgLength: number
}

const CONTENT_FIRST_HELPERS = new Set(["button_tag"])
const CONTENT_SECOND_HELPERS = new Set(["content_tag", "label_tag"])
const ARG_SHIFTING_HELPERS = new Set(["link_to", "button_to"])

class ContentAndBlockCollector extends PrismVisitor {
  public readonly offenses: ContentAndBlockOffense[] = []

  visitCallNode(node: any): void {
    this.checkCall(node)
    this.visitChildNodes(node)
  }

  private checkCall(node: any): void {
    if (!node.block) return

    const helperName = this.getHelperName(node)
    if (!helperName) return

    const contentArg = this.getContentArgument(node, helperName)
    if (!contentArg) return

    this.offenses.push({
      helperName,
      startOffset: node.location.startOffset,
      length: node.location.length,
      contentArgStartOffset: contentArg.location.startOffset,
      contentArgLength: contentArg.location.length,
    })
  }

  private getHelperName(node: PrismNode): string | null {
    const name = node.name

    if (CONTENT_FIRST_HELPERS.has(name) || CONTENT_SECOND_HELPERS.has(name) || ARG_SHIFTING_HELPERS.has(name)) {
      return name
    }

    if (node.receiver?.constructor?.name === "CallNode" && node.receiver.name === "tag") {
      return `tag.${name}`
    }

    return null
  }

  private getContentArgument(node: any, helperName: string): any | null {
    const args = node.arguments_
    if (!args) return null

    const allArgs: any[] = args.arguments_ || []
    const positionalArgs = allArgs.filter((arg: any) => arg.constructor.name !== "KeywordHashNode")

    if (helperName.startsWith("tag.")) {
      return positionalArgs.length > 0 ? positionalArgs[0] : null
    }

    if (CONTENT_FIRST_HELPERS.has(helperName)) {
      return positionalArgs.length > 0 ? positionalArgs[0] : null
    }

    if (CONTENT_SECOND_HELPERS.has(helperName)) {
      return positionalArgs.length > 1 ? positionalArgs[1] : null
    }

    if (ARG_SHIFTING_HELPERS.has(helperName)) {
      return positionalArgs.length > 1 ? positionalArgs[1] : null
    }

    return null
  }
}

export class ActionViewNoContentAndBlockRule extends ParserRule {
  static ruleName = "actionview-no-content-and-block"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
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

    const collector = new ContentAndBlockCollector()
    collector.visit(prismNode)

    const offenses: UnboundLintOffense[] = []

    for (const offense of collector.offenses) {
      const contentArgLocation = locationFromOffset(source, offense.contentArgStartOffset, offense.contentArgLength)

      const message = ARG_SHIFTING_HELPERS.has(offense.helperName)
        ? `Avoid passing both a content argument and a block to \`${offense.helperName}\`. When a block is given, arguments are shifted and the content argument is reinterpreted as the URL, which causes a runtime error.`
        : `Avoid passing both a content argument and a block to \`${offense.helperName}\`. The block content takes precedence and the argument is silently ignored.`

      offenses.push({
        ...this.createOffense(message, contentArgLocation),
        tags: ["unnecessary"],
      })
    }

    return offenses
  }
}
