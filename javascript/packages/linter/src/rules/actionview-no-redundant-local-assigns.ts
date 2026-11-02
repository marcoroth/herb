import { ParserRule } from "../types.js"
import { PrismVisitor } from "@herb-tools/core"

import { locationFromByteOffset } from "@herb-tools/core"
import { isPartialFile } from "../utils/file-utils.js"
import { LOCAL_ASSIGNS, isRedundantLocalAssignsLookup, localAssignsLookupFor, strictLocalsDeclarationOf } from "../utils/strict-locals-utils.js"

import type { ParseResult, ParserOptions, PrismNodes } from "@herb-tools/core"
import type { LocalAssignsLookup, StrictLocalsDeclarationCollector } from "../utils/strict-locals-utils.js"
import type { FullRuleConfig, LintContext, UnboundLintOffense } from "../types.js"

class LocalAssignsLookupCollector extends PrismVisitor {
  readonly lookups: LocalAssignsLookup[] = []

  override visitCallNode(node: PrismNodes.CallNode): void {
    const lookup = localAssignsLookupFor(node)

    if (lookup) this.lookups.push(lookup)

    this.visitChildNodes(node)
  }
}

export class ActionViewNoRedundantLocalAssignsRule extends ParserRule {
  static ruleName = "actionview-no-redundant-local-assigns"
  static introducedIn = this.version("0.11.0")
  static defaultEnabledIn = this.version("0.11.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: {
        cli: "error",
        editor: "info",
      },
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
    if (isPartialFile(context?.fileName) === false) return []

    const document = result.value
    const source = document.source
    const program = document.prismNode

    if (!source || !program) return []

    const declaration = strictLocalsDeclarationOf(document)

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

  private messageFor(lookup: LocalAssignsLookup, declaration: StrictLocalsDeclarationCollector): string | null {
    if (!isRedundantLocalAssignsLookup(lookup, declaration)) return null

    const local = declaration.locals.get(lookup.name)
    const source = this.lookupSource(lookup)

    if (!local) {
      return `\`${lookup.name}\` is not declared in the \`locals:\` declaration, so Rails raises if a caller passes it and \`${source}\` can never find it. Declare \`${lookup.name}:\` in the declaration, or remove the lookup.`
    }

    if (lookup.presence) {
      return `Strict local \`${lookup.name}\` is required, so \`${source}\` is always \`true\`. Remove the condition, or give \`${lookup.name}\` a default value to make it optional.`
    }

    return `Strict local \`${lookup.name}\` is already a local variable in this partial, so \`${source}\` reads back a value that is already in scope. Use \`${lookup.name}\` instead.`
  }

  private lookupSource(lookup: LocalAssignsLookup): string {
    const argument = lookup.extraArguments ? `:${lookup.name}, ...` : `:${lookup.name}`

    return lookup.method === "[]" ? `${LOCAL_ASSIGNS}[${argument}]` : `${LOCAL_ASSIGNS}.${lookup.method}(${argument})`
  }
}
