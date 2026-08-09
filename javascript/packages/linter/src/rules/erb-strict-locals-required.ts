import { ParserRule } from "../types.js"
import { Location, ERBStrictLocalsNode, RubyReferenceCollector, createLiteral, isProbableLocal, strictLocalsDeclaration } from "@herb-tools/core"
import { BaseRuleVisitor } from "./rule-utils.js"

import { isPartialFile } from "./file-utils.js"

import type { BaseAutofixContext, UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, DocumentNode, InferredSignature, StrictLocal } from "@herb-tools/core"

const LOCAL_ASSIGNS = "local_assigns"

interface StrictLocalsRequiredAutofixContext extends BaseAutofixContext {
  declaration: string
}

interface BodyLocals {
  names: string[]
  usesLocalAssigns: boolean
}

class ERBStrictLocalsRequiredVisitor extends BaseRuleVisitor {
  foundStrictLocals: boolean = false

  visitERBStrictLocalsNode(_node: ERBStrictLocalsNode): void {
    this.foundStrictLocals = true
  }
}

function localsUsedInBody(document: DocumentNode): BodyLocals {
  const program = document.prismNode

  if (!program) {
    return {
      names: [],
      usesLocalAssigns: false
    }
  }

  const collector = new RubyReferenceCollector()

  collector.visit(program)

  const bound = new Set(collector.localBindings.map(binding => binding.name))
  const names: string[] = []

  let usesLocalAssigns = false

  for (const call of collector.bareCalls) {
    if (call.name === LOCAL_ASSIGNS) {
      usesLocalAssigns = true

      continue
    }

    if (bound.has(call.name)) continue
    if (!isProbableLocal(call.name)) continue
    if (names.includes(call.name)) continue

    names.push(call.name)
  }

  return { names, usesLocalAssigns }
}

function mergeLocals(fromCallSites: StrictLocal[], fromBody: string[]): StrictLocal[] {
  const locals = [...fromCallSites]

  for (const name of fromBody) {
    if (locals.some(local => local.name === name)) continue

    locals.push({ name, required: false })
  }

  return locals.sort((left, right) => left.name.localeCompare(right.name))
}

export class ERBStrictLocalsRequiredRule extends ParserRule<StrictLocalsRequiredAutofixContext> {
  static unsafeAutocorrectable = true
  static ruleName = "erb-strict-locals-required"
  static introducedIn = this.version("0.8.8")

  get parserOptions() {
    return {
      strict_locals: true,
      prism_program: true
    }
  }

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "error",
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<StrictLocalsRequiredAutofixContext>[] {
    if (isPartialFile(context?.fileName) !== true) return []

    const visitor = new ERBStrictLocalsRequiredVisitor(this.ruleName, context)
    visitor.visit(result.value)

    if (visitor.foundStrictLocals) return []

    const document = result.value
    const firstChild = document.children[0]
    const end = firstChild ? firstChild.location.end : Location.zero.end

    return [
      this.createOffense(
        "Partial is missing a strict locals declaration. Add `<%# locals: (...) %>` at the top of the file.",
        Location.from(1, 0, end.line, end.column),
        { node: document, declaration: this.declarationFor(document, context), unsafe: true }
      )
    ]
  }

  autofix(offense: LintOffense<StrictLocalsRequiredAutofixContext>, result: ParseResult): ParseResult | null {
    const declaration = offense.autofixContext?.declaration
    if (!declaration) return null

    result.value.children.unshift(createLiteral(`${declaration}\n\n`))

    return result
  }

  private declarationFor(document: DocumentNode, context?: Partial<LintContext>): string {
    const body = localsUsedInBody(document)
    const signature = this.signatureFor(context)

    return strictLocalsDeclaration({
      locals: mergeLocals(signature?.locals ?? [], body.names),
      callSiteCount: signature?.callSiteCount ?? 0,
      keywordRest: (signature?.keywordRest ?? true) || body.usesLocalAssigns
    })
  }

  private signatureFor(context?: Partial<LintContext>): InferredSignature | null {
    const callers = context?.partialCallers
    if (!callers || !context?.fileName) return null

    const signature = callers.inferSignature(context.fileName)

    return signature.callSiteCount > 0 ? signature : null
  }
}
