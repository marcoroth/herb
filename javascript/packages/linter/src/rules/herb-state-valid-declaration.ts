import { BaseRuleVisitor, locationFromContentOffset } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"
import { stateSignatureOf } from "../utils/state-directives-utils.js"

import { isRubyParameterNode, Location } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ParserOptions, ERBContentNode, ERBBlockNode, ERBStrictLocalsNode } from "@herb-tools/core"
import type { StateDeclaration } from "@herb-tools/client/directives"

class StrictLocalsCollector extends BaseRuleVisitor {
  public readonly locals = new Set<string>()

  visitERBStrictLocalsNode(node: ERBStrictLocalsNode): void {
    for (const parameter of node.locals) {
      if (!isRubyParameterNode(parameter)) continue

      const name = parameter.name?.value

      if (name) this.locals.add(name)
    }
  }
}

class StateValidDeclarationVisitor extends BaseRuleVisitor {
  private locals: Set<string>
  private scopes: Set<string>[] = [new Set()]
  private itemNames = new Set<string>()

  constructor(ruleName: string, locals: Set<string>, context?: Partial<LintContext>) {
    super(ruleName, context)

    this.locals = locals
  }

  visitERBBlockNode(node: ERBBlockNode): void {
    this.scopes.push(new Set())

    super.visitERBBlockNode(node)

    const finished = this.scopes.pop()

    for (const name of finished ?? []) {
      this.itemNames.add(name)
    }
  }

  visitERBContentNode(node: ERBContentNode): void {
    const parsed = stateSignatureOf(node)

    if (!parsed) return

    if (parsed.malformed === "unparseable") {
      this.addOffense(
        `\`herb:state ${parsed.signature}\` does not parse. Declare states as keyword parameters with defaults, like \`(pending: false)\`.`,
        this.contentLocation(node, parsed.signatureOffset, parsed.signature.length),
      )

      return
    }

    if (parsed.malformed === "not-keywords") {
      this.addOffense(
        `\`herb:state ${parsed.signature}\` must declare keyword parameters with defaults, like \`(pending: false)\`.`,
        this.contentLocation(node, parsed.signatureOffset, parsed.signature.length),
      )

      return
    }

    for (const declaration of parsed.declarations) {
      this.checkDeclaration(node, declaration)
    }
  }

  private checkDeclaration(node: ERBContentNode, declaration: StateDeclaration): void {
    const nameLocation = this.contentLocation(node, declaration.nameOffset, declaration.name.length)
    const defaultLocation = this.contentLocation(node, declaration.defaultOffset, Math.max(declaration.defaultSource.length, 1))

    switch (declaration.kind) {
      case "missing":
        this.addOffense(
          `The state \`${declaration.name}\` has no default. Add one, like \`${declaration.name}: false\`. The server renders a state as its default, so a state always has a value.`,
          nameLocation,
        )

        return
      case "float":
        this.addOffense(
          `The state \`${declaration.name}\` has a Float default. Use an Integer or a String instead, since Ruby and JavaScript print floats differently.`,
          defaultLocation,
        )

        return
      case "array":
        this.addOffense(
          `The state \`${declaration.name}\` has an Array default. Declare a per-row boolean inside the loop instead, like \`${declaration.name}: false\`. A list on the page is a collection of items, not a state.`,
          defaultLocation,
        )

        return
      case "hash":
        this.addOffense(
          `The state \`${declaration.name}\` has a Hash default. Declare each leaf as its own state, like \`${declaration.name}_title: ""\`.`,
          defaultLocation,
        )

        return
      case "bare":
        if (!this.locals.has(declaration.defaultSource)) {
          this.addOffense(
            `The state \`${declaration.name}\` defaults to \`${declaration.defaultSource}\`, which is not a declared strict local. Declare it, like \`<%# locals: (${declaration.defaultSource}: false) %>\`, or use a literal default. A bare name a caller never passed raises a \`NameError\` at render.`,
            defaultLocation,
          )

          return
        }
    }

    if (this.locals.has(declaration.name)) {
      this.addOffense(
        `\`${declaration.name}\` is both a strict local and a state. Rename one of them. A local comes from the caller and a state is client-owned, so one name cannot be both.`,
        nameLocation,
      )

      return
    }

    const scope = this.scopes[this.scopes.length - 1]

    if (scope.has(declaration.name)) {
      this.addOffense(
        `The state \`${declaration.name}\` is declared twice in the same scope. Remove one of the declarations.`,
        nameLocation,
      )

      return
    }

    const region = this.scopes[0]
    const shadowed = scope === region
      ? this.itemNames.has(declaration.name)
      : this.scopes.some((enclosing) => enclosing !== scope && enclosing.has(declaration.name))

    if (shadowed) {
      this.addOffense(
        `The state \`${declaration.name}\` is declared in both an item and its region. Rename one of them, since a read of \`${declaration.name}\` could mean either.`,
        nameLocation,
      )

      return
    }

    scope.add(declaration.name)
  }

  private contentLocation(node: ERBContentNode, offset: number, length: number): Location {
    const content = node.content

    if (!content) return node.location

    const base = content.location.start
    const start = locationFromContentOffset(base.line, base.column, content.value, offset).start
    const end = locationFromContentOffset(base.line, base.column, content.value, offset + length).start

    return new Location(start, end)
  }
}

export class HerbStateValidDeclarationRule extends ParserRule {
  static ruleName = "herb-state-valid-declaration"
  static introducedIn = this.version("unreleased")

  get parserOptions(): Partial<ParserOptions> {
    return {
      strict_locals: true,
    }
  }

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const collector = new StrictLocalsCollector(this.ruleName, context)

    collector.visit(result.value)

    const visitor = new StateValidDeclarationVisitor(this.ruleName, collector.locals, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
