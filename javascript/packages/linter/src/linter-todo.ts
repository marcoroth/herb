import YAML from "yaml"
import { existsSync, unlinkSync, readFileSync, writeFileSync } from "fs"
import { join, relative, isAbsolute } from "path"

import { LinterRule, LintOffense } from "./types"

export interface TodoConfig {
  excludes: {
    [rule: LinterRule]: {
      [filePath: string]: {
        warning: number
        error: number
      }
    }
  }
}

export class LinterTodo {
  private static readonly TODO_FILE = ".herb-todo.yml"
  private todoConfig: TodoConfig | null = null
  private readonly projectPath: string
  private readonly todoPath: string

  constructor(projectPath: string) {
    this.projectPath = projectPath
    this.todoPath = join(this.projectPath, LinterTodo.TODO_FILE)
    this.loadTodoConfig()
  }

  clearTodoFile(): void {
    if (!this.todoExists()) return
    unlinkSync(this.todoPath)
    this.loadTodoConfig()
  }

  generateTodoConfig(offenses: Record<string, LintOffense[]>): void {
    const config: TodoConfig = { excludes: {} }
    for (const filePath of Object.keys(offenses)) {
      const fileOffenses = offenses[filePath]
      const relativePath = isAbsolute(filePath) ? relative(this.projectPath, filePath) : filePath
      for (const offense of fileOffenses) {
        const ruleName = offense.rule
        const ruleEntry = (config.excludes[ruleName] ??= {})
        const ruleBaseline = (ruleEntry[relativePath] ??= { warning: 0, error: 0 })

        if (offense.severity !== "warning" && offense.severity !== "error") {
          continue
        }

        ruleBaseline[offense.severity]++
      }
    }
    writeFileSync(this.todoPath, YAML.stringify(config))
  }

  filterOffenses(
    offenses: LintOffense[],
    filePath: string,
  ): LintOffense[] {
    if (!this.todoConfig) return offenses

    const relativePath = isAbsolute(filePath) ? relative(this.projectPath, filePath): filePath
    const filteredOffenses: LintOffense[] = []

    const ruleOffensesCounts = new Map<LinterRule, { error: number; warning: number }>()

    for (const offense of offenses) {
      if (offense.severity !== "error" && offense.severity !== "warning") {
        filteredOffenses.push(offense)
        continue
      }

      const ruleEntry = this.todoConfig.excludes[offense.rule]
      const ruleBaseline = ruleEntry ? ruleEntry[relativePath] : undefined

      if (!ruleBaseline) {
        filteredOffenses.push(offense)
        continue
      }

      if (!ruleOffensesCounts.has(offense.rule)) {
        ruleOffensesCounts.set(offense.rule, { error: 0, warning: 0 })
      }

      const ruleCounts = ruleOffensesCounts.get(offense.rule)!

      if (ruleCounts[offense.severity] < ruleBaseline[offense.severity]) {
        ruleCounts[offense.severity]++
        continue
      }

      filteredOffenses.push(offense)
    }

    return filteredOffenses
  }

  private todoExists(): boolean {
    return existsSync(this.todoPath)
  }

  private loadTodoConfig(): void {
    if (!this.todoExists()) {
      this.todoConfig = { excludes: {} }
      return
    }

    try {
      const content = readFileSync(this.todoPath, "utf8")
      const parsed: TodoConfig = YAML.parse(content)
      this.todoConfig = parsed
    } catch {
      console.log(
        "Warning: Failed to load .herb-todo.yml. Ignoring todo configuration.",
      )
      this.todoConfig = { excludes: {} }
    }
  }
}
