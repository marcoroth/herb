import { Location } from "@herb-tools/core"
import { SourceRule } from "../types.js"

import { getBasename } from "../utils/file-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

interface TemplateFileName {
  name: string
  segments: string[]
  variant: string | null
}

function parseTemplateFileName(basename: string): TemplateFileName | null {
  const segments = basename.split(".")
  if (segments.length < 2) return null

  if (segments.pop() !== "erb") return null

  const lastSegment = segments.pop()!
  const variantIndex = lastSegment.indexOf("+")
  const variant = variantIndex === -1 ? null : lastSegment.slice(variantIndex + 1)
  const withoutVariant = variantIndex === -1 ? lastSegment : lastSegment.slice(0, variantIndex)

  segments.push(withoutVariant)

  const name = segments.shift()!
  if (name === "" || name === "_") return null

  return { name, segments, variant }
}

function suggestedBasename(fileName: TemplateFileName): string {
  const variant = fileName.variant === null ? "" : `+${fileName.variant}`

  return `${fileName.name}.html${variant}.erb`
}

export class ERBRequireTemplateFormatRule extends SourceRule {
  static ruleName = "erb-require-template-format"
  static introducedIn = this.version("unreleased")
  static defaultEnabledIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
    }
  }

  check(source: string, context?: Partial<LintContext>): UnboundLintOffense[] {
    if (!context?.fileName) return []

    const basename = getBasename(context.fileName)
    const fileName = parseTemplateFileName(basename)

    if (!fileName || fileName.segments.length > 0) return []

    const [firstLine] = source.split("\n")

    return [
      this.createOffense(
        `Template \`${basename}\` has no format in its file name, so Herb and the framework rendering it cannot tell what it outputs. Rename it to \`${suggestedBasename(fileName)}\`, or name the format it renders.`,
        Location.from(1, 0, 1, firstLine?.length ?? 0),
      )
    ]
  }
}
