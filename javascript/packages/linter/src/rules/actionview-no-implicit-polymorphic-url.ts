import { ParserRule } from "../types.js"
import { PrismVisitor, isPrismNodeType, locationFromByteOffset, substringFromByteOffset, getHelperEntries } from "@herb-tools/core"

import type { ParseResult, ParserOptions, PrismNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

const URL_SEGMENTS = new Set(["url", "urls", "uri", "uris"])
const URL_SUFFIXES = new Set(["path", "paths", "href", "link", "links", "options"])

const ARGUMENT_POSITIONS: Record<string, number> = {
  first_arg: 0,
  second_arg: 1,
  third_arg: 2,
}

const URL_FOR_HELPERS = new Map(
  getHelperEntries()
    .filter(helper => helper.implicitAttribute?.wrapper === "url_for")
    .flatMap(helper => [helper.name, ...helper.aliases].map(name => [name, helper] as const))
)

interface ImplicitPolymorphicURL {
  argument: PrismNode
  helperName: string
}

function urlArgument(node: PrismNode): ImplicitPolymorphicURL | null {
  if (!isPrismNodeType(node, "CallNode")) return null
  if (node.receiver) return null

  const helper = URL_FOR_HELPERS.get(node.name)
  const implicitAttribute = helper?.implicitAttribute

  if (!helper || !implicitAttribute) return null

  const args = node.arguments_?.arguments_

  if (!args || args.length === 0) return null

  const hasBlock = isPrismNodeType(node.block, "BlockNode")
  const source = hasBlock ? (implicitAttribute.sourceWithBlock ?? implicitAttribute.source) : implicitAttribute.source
  const index = ARGUMENT_POSITIONS[source]

  if (index === undefined) return null

  const argument = args.length === 1 ? args[0] : args[index]

  if (!argument) return null

  return { argument, helperName: helper.name }
}

function isURLLikeName(name: string): boolean {
  const segments = name.replace(/^@/, "").toLowerCase().split("_")
  const last = segments[segments.length - 1]

  if (segments.some(segment => URL_SEGMENTS.has(segment))) return true
  if (URL_SUFFIXES.has(last)) return true

  return last.endsWith("url") || last.endsWith("uri")
}

class ImplicitPolymorphicURLCollector extends PrismVisitor {
  public readonly urls: ImplicitPolymorphicURL[] = []

  visitCallNode(node: PrismNode): void {
    const url = urlArgument(node)

    if (url && isPrismNodeType(url.argument, "InstanceVariableReadNode") && !isURLLikeName(url.argument.name)) {
      this.urls.push(url)
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

    return collector.urls.map(({ argument, helperName }) => {
      const { startOffset, length } = argument.location
      const location = locationFromByteOffset(source, startOffset, length)
      const variable = substringFromByteOffset(source, startOffset, length)
      const routeHelper = `${variable.replace(/^@/, "")}_path`

      return this.createOffense(
        `Avoid passing \`${variable}\` directly to \`${helperName}\`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like \`${routeHelper}(${variable})\`, or \`polymorphic_path(${variable})\` when the route has to be resolved from the model.`,
        location,
      )
    })
  }
}
