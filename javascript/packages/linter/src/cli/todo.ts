import { relative, resolve } from "path"

import type { TodoExcludes } from "@herb-tools/config"
import type { ProcessedFile } from "./file-processor.js"

// A template the parser can't read must always fail, so it never goes on the todo list.
const PROTECTED_RULES = new Set(["parser-no-errors"])

/**
 * Group the offenses that fail a run (errors and warnings) by rule, as project-relative file paths.
 */
export function collectTodoExcludes(offenses: ProcessedFile[], projectPath: string): TodoExcludes {
  const filesByRule = new Map<string, Set<string>>()

  for (const { filename, offense } of offenses) {
    const ruleName = offense.code

    if (!ruleName || PROTECTED_RULES.has(ruleName)) continue
    if (offense.severity !== "error" && offense.severity !== "warning") continue

    const relativePath = relative(projectPath, resolve(projectPath, filename))
    const files = filesByRule.get(ruleName) ?? new Set<string>()

    files.add(relativePath)
    filesByRule.set(ruleName, files)
  }

  return Object.fromEntries(Array.from(filesByRule, ([ruleName, files]) => [ruleName, Array.from(files).sort()]))
}
