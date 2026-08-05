import { ParserRule } from "../types.js"
import { PrismVisitor, isPrismNodeType, locationFromByteOffset, substringFromByteOffset } from "@herb-tools/core"

import type { ParseResult, ParserOptions, PrismNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

const URL_SEGMENTS = new Set(["url", "urls", "uri", "uris"])
const URL_SUFFIXES = new Set(["path", "paths", "href", "link", "links", "options"])

function urlArgument(node: PrismNode): PrismNode | null {
  if (!isPrismNodeType(node, "CallNode")) return null
  if (node.receiver) return null
  if (node.name !== "link_to") return null

  const args = node.arguments_?.arguments_

  if (!args || args.length === 0) return null

  const hasBlock = isPrismNodeType(node.block, "BlockNode")
  const index = (hasBlock || args.length === 1) ? 0 : 1

  return args[index] ?? null
}

function isURLLikeName(name: string): boolean {
  const segments = name.replace(/^@/, "").toLowerCase().split("_")
  const last = segments[segments.length - 1]

  if (segments.some(segment => URL_SEGMENTS.has(segment))) return true
  if (URL_SUFFIXES.has(last)) return true

  return last.endsWith("url") || last.endsWith("uri")
}

class ImplicitPolymorphicURLCollector extends PrismVisitor {
  public readonly urlArguments: PrismNode[] = []

  visitCallNode(node: PrismNode): void {
    const url = urlArgument(node)

    if (url && isPrismNodeType(url, "InstanceVariableReadNode") && !isURLLikeName(url.name)) {
      this.urlArguments.push(url)
    }

    this.visitChildNodes(node)
  }
}

export class ActionViewNoImplicitPolymorphicURLRule extends ParserRule {
  static ruleName = "actionview-no-implicit-polymorphic-url"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "info",
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

    const collector = new ImplicitPolymorphicURLCollector()

    collector.visit(prismNode)

    return collector.urlArguments.map(url => {
      const { startOffset, length } = url.location
      const location = locationFromByteOffset(source, startOffset, length)
      const variable = substringFromByteOffset(source, startOffset, length)
      const helper = `${variable.replace(/^@/, "")}_path`

      return this.createOffense(
        `Avoid passing \`${variable}\` directly to \`link_to\`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like \`${helper}(${variable})\`, or \`polymorphic_path(${variable})\` when the route has to be resolved from the model.`,
        location,
      )
    })
  }
}
