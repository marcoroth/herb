import { ParserRule } from "../types.js"
import { PrismVisitor, Visitor } from "@herb-tools/core"

import { isPrismNodeType, isRubyParameterNode, locationFromByteOffset } from "@herb-tools/core"
import { isPartialFile } from "./file-utils.js"

import type { DocumentNode, ERBStrictLocalsNode, ParseResult, ParserOptions, PrismNodes, RubyParameterNode } from "@herb-tools/core"
import type { FullRuleConfig, LintContext, UnboundLintOffense } from "../types.js"

const KEYWORD_KIND = "keyword"
const KEYWORD_REST_KIND = "keyword_rest"
const LOCAL_ASSIGNS = "local_assigns"

const VALUE_LOOKUPS = ["[]", "fetch", "dig"]
const PRESENCE_LOOKUPS = ["key?", "has_key?", "include?", "member?"]

interface Lookup {
  name: string
  method: string
  presence: boolean
  extraArguments: boolean
  startOffset: number
  length: number
}

class StrictLocalsCollector extends Visitor {
  hasDeclaration = false
  hasKeywordRest = false

  readonly locals = new Map<string, RubyParameterNode>()

  visitERBStrictLocalsNode(node: ERBStrictLocalsNode): void {
    this.hasDeclaration = true

    for (const local of node.locals) {
      if (!isRubyParameterNode(local)) continue

      if (local.kind === KEYWORD_REST_KIND) {
        this.hasKeywordRest = true
        continue
      }

      if (local.kind !== KEYWORD_KIND) continue

      const name = local.name?.value

      if (name) this.locals.set(name, local)
    }
  }
}

class LocalAssignsLookupCollector extends PrismVisitor {
  readonly lookups: Lookup[] = []

  override visitCallNode(node: PrismNodes.CallNode): void {
    const lookup = this.lookupFor(node)

    if (lookup) this.lookups.push(lookup)

    this.visitChildNodes(node)
  }

  private lookupFor(node: PrismNodes.CallNode): Lookup | null {
    const presence = PRESENCE_LOOKUPS.includes(node.name)

    if (!presence && !VALUE_LOOKUPS.includes(node.name)) return null
    if (!this.isLocalAssignsRead(node.receiver)) return null

    const argumentNodes = node.arguments_?.arguments_ ?? []
    const [first, ...rest] = argumentNodes

    if (!isPrismNodeType(first, "SymbolNode")) return null
    if (rest.length > 0 && node.name !== "fetch") return null
    if (rest.length > 1) return null

    const name = first.unescaped?.value

    if (!name) return null

    return {
      name,
      method: node.name,
      presence,
      extraArguments: rest.length > 0,
      startOffset: node.location.startOffset,
      length: node.location.length,
    }
  }

  private isLocalAssignsRead(node: PrismNodes.Node | null): boolean {
    if (!isPrismNodeType(node, "CallNode")) return false
    if (node.receiver !== null) return false

    return node.name === LOCAL_ASSIGNS
  }
}

export class ActionViewNoRedundantLocalAssignsRule extends ParserRule {
  static ruleName = "actionview-no-redundant-local-assigns"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: {
        cli: "error",
        editor: "info",
      },
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      strict_locals: true,
      prism_program: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    if (isPartialFile(context?.fileName) === false) return []

    const document = result.value
    const source = document.source
    const program = document.prismNode

    if (!source || !program) return []

    const declaration = this.declarationFor(document)

    if (!declaration.hasDeclaration) return []

    const collector = new LocalAssignsLookupCollector()

    collector.visit(program)

    return collector.lookups.flatMap(lookup => {
      const message = this.messageFor(lookup, declaration)

      if (!message) return []

      const location = locationFromByteOffset(source, lookup.startOffset, lookup.length)

      return [this.createOffense(message, location, undefined, undefined, ["unnecessary"])]
    })
  }

  private declarationFor(document: DocumentNode): StrictLocalsCollector {
    const collector = new StrictLocalsCollector()

    collector.visit(document)

    return collector
  }

  private messageFor(lookup: Lookup, declaration: StrictLocalsCollector): string | null {
    const local = declaration.locals.get(lookup.name)
    const source = this.lookupSource(lookup)

    if (!local) {
      if (declaration.hasKeywordRest) return null

      return `\`${lookup.name}\` is not declared in the \`locals:\` declaration, so Rails raises if a caller passes it and \`${source}\` can never find it. Declare \`${lookup.name}:\` in the declaration, or remove the lookup.`
    }

    if (!local.required) return null

    if (lookup.presence) {
      return `Strict local \`${lookup.name}\` is required, so \`${source}\` is always \`true\`. Remove the condition, or give \`${lookup.name}\` a default value to make it optional.`
    }

    return `Strict local \`${lookup.name}\` is already a local variable in this partial, so \`${source}\` reads back a value that is already in scope. Use \`${lookup.name}\` instead.`
  }

  private lookupSource(lookup: Lookup): string {
    const argument = lookup.extraArguments ? `:${lookup.name}, ...` : `:${lookup.name}`

    return lookup.method === "[]" ? `${LOCAL_ASSIGNS}[${argument}]` : `${LOCAL_ASSIGNS}.${lookup.method}(${argument})`
  }
}
