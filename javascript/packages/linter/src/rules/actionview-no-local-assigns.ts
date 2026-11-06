import { ParserRule } from "../types.js"
import { PrismVisitor, SourceOffsets } from "@herb-tools/core"

import { isPrismNodeType } from "@herb-tools/core"
import { isPartialFile } from "../utils/file-utils.js"
import { LOCAL_ASSIGNS, isLocalAssignsRead, isRedundantLocalAssignsLookup, localAssignsLookupFor, strictLocalsDeclarationOf } from "../utils/strict-locals-utils.js"

import type { ParseResult, ParserOptions, PrismNodes } from "@herb-tools/core"
import type { StrictLocalsDeclarationCollector } from "../utils/strict-locals-utils.js"
import type { FullRuleConfig, LintContext, UnboundLintOffense } from "../types.js"

const NEW_DECLARATION = "a `<%# locals: (...) %>` declaration at the top of the template"
const EXISTING_DECLARATION = "the template's `locals:` declaration"
const KEEP_WITH_DISABLE = "keep it with a `herb:disable` comment"

const VALUE_LOOKUPS = ["[]", "dig"]
const PRESENCE_LOOKUPS = ["key?", "has_key?", "include?", "member?"]
const FETCH = "fetch"

type ReadKind = "value" | "fetch" | "presence" | "other"

interface LocalAssignsRead {
  kind: ReadKind
  node: PrismNodes.CallNode
  name: string | null
}

class LocalAssignsReadCollector extends PrismVisitor {
  readonly reads: LocalAssignsRead[] = []

  private readonly lookedUp = new Set<PrismNodes.CallNode>()

  override visitCallNode(node: PrismNodes.CallNode): void {
    const lookup = this.lookupFor(node)

    if (lookup) {
      this.lookedUp.add(node.receiver as PrismNodes.CallNode)
      this.reads.push(lookup)
    } else if (isLocalAssignsRead(node) && !this.lookedUp.has(node)) {
      this.reads.push({ kind: "other", node, name: null })
    }

    this.visitChildNodes(node)
  }

  private lookupFor(node: PrismNodes.CallNode): LocalAssignsRead | null {
    if (!isLocalAssignsRead(node.receiver)) return null

    const kind = this.kindOf(node.name)

    if (!kind) return null

    const [first] = node.arguments_?.arguments_ ?? []

    if (!isPrismNodeType(first, "SymbolNode")) return null

    const name = first.unescaped?.value

    if (!name) return null

    return { kind, node, name }
  }

  private kindOf(method: string): ReadKind | null {
    if (VALUE_LOOKUPS.includes(method)) return "value"
    if (PRESENCE_LOOKUPS.includes(method)) return "presence"
    if (method === FETCH) return "fetch"

    return null
  }
}

export class ActionViewNoLocalAssignsRule extends ParserRule {
  static ruleName = "actionview-no-local-assigns"
  static introducedIn = this.version("0.11.1")
  static defaultEnabledIn = this.version("0.11.1")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "info",
      frameworks: ["actionview"],
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      strict_locals: true,
      prism_program: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const document = result.value
    const source = document.source
    const program = document.prismNode

    if (!source || !program) return []

    const declaration = strictLocalsDeclarationOf(document)
    const checksRedundantLookups = declaration.hasDeclaration && isPartialFile(context?.fileName) !== false

    const collector = new LocalAssignsReadCollector()

    collector.visit(program)

    const offsets = new SourceOffsets(source)

    return collector.reads.flatMap(read => {
      if (checksRedundantLookups && this.isRedundant(read, declaration)) return []

      const { startOffset, length } = read.node.location
      const location = offsets.locationFromByteOffset(startOffset, length)

      return [this.createOffense(this.messageFor(read, declaration, offsets), location)]
    })
  }

  private isRedundant(read: LocalAssignsRead, declaration: StrictLocalsDeclarationCollector): boolean {
    const lookup = localAssignsLookupFor(read.node)

    return lookup !== null && isRedundantLocalAssignsLookup(lookup, declaration)
  }

  private messageFor(read: LocalAssignsRead, declaration: StrictLocalsDeclarationCollector, offsets: SourceOffsets): string {
    const code = this.codeOf(read.node, offsets)

    if (!read.name) {
      if (declaration.hasDeclaration) {
        return `\`${code}\` is used next to a strict locals declaration. Read the declared locals by name, or ${KEEP_WITH_DISABLE} where it forwards every local on purpose.`
      }

      return `\`${code}\` is used in a template without a strict locals declaration. Declare the locals the template takes in ${NEW_DECLARATION}, so Rails raises when a caller passes one it does not list.`
    }

    const local = declaration.locals.get(read.name)

    if (local?.required && read.kind === "presence") {
      return `\`${code}\` checks for strict local \`${read.name}\`, which is required, so the check is always \`true\`. Remove the condition, or give \`${read.name}\` a default value to make it optional.`
    }

    if (local && read.kind === "presence") {
      return `\`${code}\` checks whether a caller passed strict local \`${read.name}\`, which the declaration cannot express. Check \`${read.name}\` itself when an omitted \`${read.name}\` and one passed as \`nil\` can be treated the same, or ${KEEP_WITH_DISABLE} if the template needs to tell them apart.`
    }

    if (local) {
      const fallback = local.required ? "" : `, which uses the declared default when a caller omits \`${read.name}\``

      return `\`${code}\` reads strict local \`${read.name}\` through \`${LOCAL_ASSIGNS}\`. Read \`${this.replacementFor(read, offsets)}\` instead${fallback}.`
    }

    const where = declaration.hasDeclaration ? EXISTING_DECLARATION : NEW_DECLARATION
    const declared = this.declaredLocal(read, offsets)
    const declare = declared ? `Declare \`${declared}\`` : `Declare \`${read.name}\` with that default value`

    if (read.kind === "presence") {
      return `\`${code}\` checks for a local the template does not declare. ${declare} in ${where}, and keep the check only if it needs to tell an omitted \`${read.name}\` from one passed as \`nil\`.`
    }

    return `\`${code}\` reads a local the template does not declare. ${declare} in ${where} and read \`${this.replacementFor(read, offsets)}\` instead.`
  }

  private declaredLocal(read: LocalAssignsRead, offsets: SourceOffsets): string | null {
    if (read.kind !== "fetch") return `${read.name}: nil`
    if (read.node.block) return null

    const [, fallback, ...rest] = read.node.arguments_?.arguments_ ?? []

    if (!fallback) return `${read.name}:`
    if (rest.length > 0) return null

    const value = offsets.substringFromByteOffset(fallback.location.startOffset, fallback.location.length)

    if (value.includes("\n")) return null

    return `${read.name}: ${value}`
  }

  private replacementFor(read: LocalAssignsRead, offsets: SourceOffsets): string {
    const [first, ...rest] = read.node.arguments_?.arguments_ ?? []

    if (read.node.name !== "dig" || rest.length === 0 || !first) return read.name ?? LOCAL_ASSIGNS

    const lastArgument = rest[rest.length - 1]
    const start = rest[0].location.startOffset
    const end = lastArgument.location.startOffset + lastArgument.location.length
    const keys = offsets.substringFromByteOffset(start, end - start)

    return `${read.name}&.dig(${keys})`
  }

  private codeOf(node: PrismNodes.CallNode, offsets: SourceOffsets): string {
    const code = offsets.substringFromByteOffset(node.location.startOffset, node.location.length)

    return code.includes("\n") ? LOCAL_ASSIGNS : code
  }
}
