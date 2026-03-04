import { Linter } from "@herb-tools/linter"
import { Project } from "stimulus-parser"

import { defaultRules } from "./default-rules.js"

import type { RuleClass, LintResult } from "./types.js"
import type { StimulusLintContext } from "./types.js"
import type { HerbBackend } from "@herb-tools/core"

export class StimulusLinter extends Linter {
  private stimulusProject?: Project

  /**
   * Creates a new StimulusLinter instance that extends Herb's Linter.
   * @param herb - The Herb backend instance for parsing HTML
   * @param rules - Array of rule classes to use
   * @param stimulusProject - Optional Stimulus project for controller analysis
   */
  constructor(herb: HerbBackend, rules: RuleClass[], stimulusProject?: Project) {
    super(herb, rules)
    this.stimulusProject = stimulusProject
    this.rules = rules
  }

  /**
   * Sets the Stimulus project for controller analysis
   */
  setProject(project: Project): void {
    this.stimulusProject = project
  }

  /**
   * Lint source code with Stimulus-specific context
   * @param source - The source code to lint (HTML template)
   * @param context - Optional context for linting
   */
  lint(source: string, context?: Partial<StimulusLintContext>): LintResult {
    const stimulusContext: Partial<StimulusLintContext> = {
      ...context,
      stimulusProject: this.stimulusProject
    }

    return super.lint(source, stimulusContext)
  }

  /**
   * Lint an HTML file and optionally analyze its associated controllers
   */
  async lintFile(filePath: string): Promise<LintResult> {
    const fs = await import("fs")
    const source = fs.readFileSync(filePath, "utf-8")

    const context: Partial<StimulusLintContext> = {
      fileName: filePath
    }

    return this.lint(source, context)
  }

  protected getDefaultRules(): RuleClass[] {
    return defaultRules
  }
}
