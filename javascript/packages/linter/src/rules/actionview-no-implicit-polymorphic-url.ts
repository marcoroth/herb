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

const IDENTIFIER = /^[a-z_][a-zA-Z0-9_]*$/

const NON_MODEL_RECEIVERS = new Set(["request", "response", "session", "params", "cookies", "flash", "controller", "helpers", "main_app"])

interface ImplicitPolymorphicURL {
  argument: PrismNode
  helperName: string
  routeCall: string | null
  routable: boolean
}

function urlArgument(node: PrismNode): Omit<ImplicitPolymorphicURL, "routeCall" | "routable"> | null {
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

function variableName(node: PrismNode): string | null {
  if (isPrismNodeType(node, "InstanceVariableReadNode")) return node.name
  if (isPrismNodeType(node, "LocalVariableReadNode")) return node.name

  return null
}

function literalSegment(node: PrismNode): string | null {
  if (!isPrismNodeType(node, "SymbolNode") && !isPrismNodeType(node, "StringNode")) return null

  const name = node.unescaped?.value

  if (typeof name !== "string" || !IDENTIFIER.test(name)) return null

  return name
}

function routeCall(routeHelper: string, routeArguments: string[]): string {
  return routeArguments.length === 0 ? routeHelper : `${routeHelper}(${routeArguments.join(", ")})`
}

function isNonModelReceiver(node: PrismNode): boolean {
  if (!isPrismNodeType(node, "CallNode") || node.receiver) return false

  return NON_MODEL_RECEIVERS.has(node.name)
}

function isModelReaderCall(node: PrismNode): boolean {
  if (!isPrismNodeType(node, "CallNode")) return false
  if (!node.receiver || node.arguments_ || node.block) return false
  if (!IDENTIFIER.test(node.name) || isURLLikeName(node.name)) return false

  return !isNonModelReceiver(node.receiver)
}

function routeParts(node: PrismNode): PrismNode[] {
  const elements: PrismNode[] = node.elements ?? []

  return elements.filter(element => !isPrismNodeType(element, "NilNode"))
}

function routeCallForArray(elements: PrismNode[]): string | null {
  const segments: string[] = []
  const routeArguments: string[] = []

  for (const element of elements) {
    const literal = literalSegment(element)

    if (literal) {
      segments.push(literal)
      continue
    }

    const name = variableName(element)

    if (!name) return null

    segments.push(name.replace(/^@/, ""))
    routeArguments.push(name)
  }

  return routeCall(`${segments.join("_")}_path`, routeArguments)
}

class ImplicitPolymorphicURLCollector extends PrismVisitor {
  public readonly urls: ImplicitPolymorphicURL[] = []

  visitCallNode(node: PrismNode): void {
    const url = urlArgument(node)
    const argument = url?.argument

    const name = url ? variableName(argument) : null

    if (url && name && !isURLLikeName(name)) {
      this.urls.push({ ...url, routeCall: routeCall(`${name.replace(/^@/, "")}_path`, [name]), routable: true })
    }

    if (url && isPrismNodeType(argument, "ArrayNode")) {
      const parts = routeParts(argument)

      this.urls.push({ ...url, routeCall: parts.length === 0 ? null : routeCallForArray(parts), routable: parts.length > 0 })
    }

    if (url && isModelReaderCall(argument)) {
      this.urls.push({ ...url, routeCall: null, routable: true })
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

    return collector.urls.map(({ argument, helperName, routeCall, routable }) => {
      const { startOffset, length } = argument.location
      const location = locationFromByteOffset(source, startOffset, length)
      const value = substringFromByteOffset(source, startOffset, length)
      const suggestion = routeCall ? `an explicit route helper like \`${routeCall}\`` : "an explicit route helper"

      if (!routable) {
        return this.createOffense(
          `Passing \`${value}\` to \`${helperName}\` raises \`ArgumentError: Nil location provided. Can't build URI.\` at runtime. Rails compacts the Array before it resolves the route, and an Array with nothing left in it has no route to resolve. Use an explicit route helper for the route this link points at.`,
          location,
          undefined,
          "error",
        )
      }

      return this.createOffense(
        `Avoid passing \`${value}\` directly to \`${helperName}\`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use ${suggestion}, or \`polymorphic_path(${value})\` when the route has to be resolved from the model.`,
        location,
      )
    })
  }
}
