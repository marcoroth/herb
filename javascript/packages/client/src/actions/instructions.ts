import { ACTION_NAMES, ACTION_SCHEMA, HERB_ATTRIBUTES } from "../grammar/attributes"

import { report } from "../shared/report"
import { defaultEventFor } from "./events"
import { balancedQuotes, clauses, names, splitOutsideQuotes, unquote } from "../grammar/parsing"

import type { Clause } from "../grammar/parsing"
import type { ActionName, ActionSchema } from "../grammar/attributes"
import type { Instruction, ResolvedDeclaration } from "./types"

export interface InstructionsDelegate {
  templateOf(element: Element): string
  declarationFor(element: Element, name: string): ResolvedDeclaration | null
}

export class Instructions {
  private delegate: InstructionsDelegate
  private parsed = new WeakMap<Element, Instruction[]>()
  private validated = new WeakSet<Element>()

  constructor(delegate: InstructionsDelegate) {
    this.delegate = delegate
  }

  forget(element: Element): void {
    this.parsed.delete(element)
    this.validated.delete(element)
  }

  of(element: Element): Instruction[] {
    const held = this.parsed.get(element)

    if (held) {
      return held
    }

    const parsed: Instruction[] = []

    for (const action of ACTION_NAMES) {
      const value = element.getAttribute(HERB_ATTRIBUTES[action])

      if (value === null) {
        continue
      }

      for (const clause of clauses(value)) {
        parsed.push({ action, event: clause.event ?? defaultEventFor(element), rest: clause.rest })
      }
    }

    this.parsed.set(element, parsed)

    return parsed
  }

  validate(element: Element): void {
    if (this.validated.has(element)) {
      return
    }

    this.validated.add(element)

    for (const name of ACTION_NAMES) {
      const attribute = HERB_ATTRIBUTES[name]
      const value = element.getAttribute(attribute)

      if (value === null) {
        continue
      }

      if (!balancedQuotes(value)) {
        report({
          template: this.delegate.templateOf(element),
          element,
          message: `\`${attribute}="${value}"\` has an unbalanced quote`,
          code: "herb-invalid-action",
          severity: "error",
        })

        continue
      }

      for (const clause of clauses(value)) {
        this.validateClause(element, name, clause)
      }
    }
  }

  private validateClause(element: Element, action: ActionName, clause: Clause): void {
    const schema: ActionSchema = ACTION_SCHEMA[action]
    const attribute = HERB_ATTRIBUTES[action]

    if (clause.event === "" || (clause.rest.trim() === "" && !schema.bare)) {
      let problem = "nothing after the event"

      if (clause.event === "") {
        problem = "no event before the arrow"
      }

      report({
        template: this.delegate.templateOf(element),
        element,
        message: `\`${attribute}\` has a clause with ${problem}`,
        code: "herb-invalid-action",
        severity: "error",
      })

      return
    }

    if (splitOutsideQuotes(clause.rest, ",").length > 1) {
      const what = schema.operation === "set" ? "assignment" : "name"

      report({
        template: this.delegate.templateOf(element),
        element,
        message: `\`${attribute}\` lists several ${what}s in one clause. A clause takes one ${what}, and each clause carries its own event or the element's default.`,
        code: "herb-invalid-action",
        severity: "error",
        suggestion: `separate the clauses with spaces, like \`${attribute}="a b"\``,
      })

      return
    }

    if (schema.operation === "action") {
      return
    }

    if (schema.operation === "set") {
      this.validateAssignment(element, clause.rest)

      return
    }

    for (const name of names(clause.rest)) {
      const resolved = this.delegate.declarationFor(element, name)

      if (!resolved) {
        continue
      }

      const kind = resolved.declaration.kind

      if (schema.needs && kind !== schema.needs && kind !== "seeded") {
        this.reportKind(resolved.scope.region.file, attribute, name, kind, schema.needs, element)
      }
    }
  }

  private validateAssignment(element: Element, assignment: string): void {
    const separator = assignment.indexOf("=")

    if (separator < 1) {
      report({
        template: this.delegate.templateOf(element),
        element,
        message: `\`${assignment.trim()}\` in \`${HERB_ATTRIBUTES.set}\` is not a \`state=value\` pair`,
        code: "herb-invalid-action",
        severity: "error",
      })

      return
    }

    const name = assignment.slice(0, separator).trim()
    const raw = unquote(assignment.slice(separator + 1).trim())
    const resolved = this.delegate.declarationFor(element, name)

    if (!resolved || raw === "$value") {
      return
    }

    const kind = resolved.declaration.kind

    if ((kind === "boolean" && raw !== "true" && raw !== "false") || (kind === "integer" && !/^-?\d+$/.test(raw))) {
      report({
        template: resolved.scope.region.file,
        element,
        message: `\`${name}=${raw}\` does not parse as a ${kind}; \`${name}\` is declared as one`,
        code: "herb-state-type",
        severity: "error",
        value: name,
      })
    }
  }

  private reportKind(template: string, attribute: string, name: string, kind: string, wanted: string, element: Element | null = null): void {
    report({
      template,
      element,
      message: `\`${attribute}\` on \`${name}\` can never work, because \`${name}\` is a ${kind} and it needs a ${wanted}`,
      code: "herb-state-type",
      severity: "error",
      value: name,
    })
  }
}
