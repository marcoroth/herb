import { defaultRules } from "./default-rules.js"
import { Location } from "@herb-tools/core"
import { IdentityPrinter } from "@herb-tools/printer"
import { findNodeByLocation } from "./rules/rule-utils.js"

import type { RuleClass, Rule, ParserRule, LexerRule, SourceRule, LintResult, LintOffense, LintContext, AutofixResult } from "./types.js"
import type { HerbBackend } from "@herb-tools/core"

export class Linter {
  protected rules: RuleClass[]
  protected herb: HerbBackend
  protected offenses: LintOffense[]

  /**
   * Creates a new Linter instance.
   * @param herb - The Herb backend instance for parsing and lexing
   * @param rules - Array of rule classes (Parser/AST or Lexer) to use. If not provided, uses default rules.
   */
  constructor(herb: HerbBackend, rules?: RuleClass[]) {
    this.herb = herb
    this.rules = rules !== undefined ? rules : this.getDefaultRules()
    this.offenses = []
  }

  /**
   * Returns the default set of rule classes used by the linter.
   * @returns Array of rule classes
   */
  protected getDefaultRules(): RuleClass[] {
    return defaultRules
  }

  getRuleCount(): number {
    return this.rules.length
  }

  /**
   * Type guard to check if a rule is a LexerRule
   */
  protected isLexerRule(rule: Rule): rule is LexerRule {
    return (rule.constructor as any).type === "lexer"
  }

  /**
   * Type guard to check if a rule is a SourceRule
   */
  protected isSourceRule(rule: Rule): rule is SourceRule {
    return (rule.constructor as any).type === "source"
  }

  private filterOffenses(ruleOffenses: LintOffense[], sourceLines: string[], ruleName: string): { kept: LintOffense[], skipped: LintOffense[] } {
    const kept: LintOffense[] = [];
    const skipped: LintOffense[] = [];

    for (const offense of ruleOffenses) {
      const line = offense.location.start.line;
      if (line > sourceLines.length) {
        kept.push(offense);
        continue;
      }
      const lineContent = sourceLines[line - 1];

      const disableCommentRegex = /<%#\s+herb:disable\s+(.*)%>/;
      const match = lineContent.match(disableCommentRegex);

      if (match) {
        const rulesRaw = (match && match[1]) || '';
        const rules = rulesRaw.split(",").map((rule) => rule.trim());
        if (rules.includes(ruleName) || rules.includes("all")) {
          skipped.push(offense);
        } else {
          kept.push(offense);
        }
      } else {
        kept.push(offense);
      }
    }

    return { kept, skipped };
  }

  /**
   * Lint source code using Parser/AST, Lexer, and Source rules.
   * @param source - The source code to lint
   * @param context - Optional context for linting (e.g., fileName for distinguishing files vs snippets)
   */
  lint(source: string, context?: Partial<LintContext>): LintResult {
    this.offenses = []
    let skippedCount = 0;

    const parseResult = this.herb.parse(source, { track_whitespace: true })
    const lexResult = this.herb.lex(source)
    const hasParserErrors = parseResult.recursiveErrors().length > 0
    const sourceLines = source.split("\n");

    for (const RuleClass of this.rules) {
      const rule = new RuleClass()

      let isEnabled = true
      let ruleOffenses: LintOffense[]

      if (this.isLexerRule(rule)) {
        if (rule.isEnabled) {
          isEnabled = rule.isEnabled(lexResult, context)
        }

        if (isEnabled) {
          ruleOffenses = (rule as LexerRule).check(lexResult, context)
        } else {
          ruleOffenses = []
        }

      } else if (this.isSourceRule(rule)) {
        if (rule.isEnabled) {
          isEnabled = rule.isEnabled(source, context)
        }

        if (isEnabled) {
          ruleOffenses = (rule as SourceRule).check(source, context)
        } else {
          ruleOffenses = []
        }
      } else {
        if (hasParserErrors && rule.name !== "parser-no-errors") {
          ruleOffenses = []

          continue
        }

        if (rule.isEnabled) {
          isEnabled = rule.isEnabled(parseResult, context)
        }

        if (isEnabled) {
          ruleOffenses = (rule as ParserRule).check(parseResult, context)
        } else {
          ruleOffenses = []
        }
      }

      const { kept, skipped } = this.filterOffenses(ruleOffenses, sourceLines, rule.name);
      skippedCount += skipped.length;

      this.offenses.push(...kept)
    }

    const errors = this.offenses.filter(offense => offense.severity === "error").length
    const warnings = this.offenses.filter(offense => offense.severity === "warning").length

    return {
      offenses: this.offenses,
      errors,
      warnings,
      skipped: skippedCount
    }
  }

  /**
   * Automatically fix offenses in the source code.
   * Uses AST mutation for parser rules and token mutation for lexer rules.
   * @param source - The source code to fix
   * @param context - Optional context for linting (e.g., fileName)
   * @param offensesToFix - Optional array of specific offenses to fix. If not provided, all fixable offenses will be fixed.
   * @returns AutofixResult containing the corrected source and lists of fixed/unfixed offenses
   */
  autofix(source: string, context?: Partial<LintContext>, offensesToFix?: LintOffense[]): AutofixResult {
    const lintResult = offensesToFix ? { offenses: offensesToFix } : this.lint(source, context)

    const parserOffenses: LintOffense[] = []
    const lexerOffenses: LintOffense[] = []
    const sourceOffenses: LintOffense[] = []

    for (const offense of lintResult.offenses) {
      const RuleClass = this.rules.find(rule => {
        const instance = new rule()
        return instance.name === offense.rule
      })

      if (!RuleClass) continue

      if ((RuleClass as any).type === "lexer") {
        lexerOffenses.push(offense)
      } else if ((RuleClass as any).type === "source") {
        sourceOffenses.push(offense)
      } else {
        parserOffenses.push(offense)
      }
    }

    let currentSource = source
    const fixed: LintOffense[] = []
    const unfixed: LintOffense[] = []

    if (parserOffenses.length > 0) {
      const parseResult = this.herb.parse(currentSource, { track_whitespace: true })

      for (const offense of parserOffenses) {
        const RuleClass = this.rules.find(rule => new rule().name === offense.rule)

        if (!RuleClass) {
          unfixed.push(offense)

          continue
        }

        const rule = new RuleClass() as ParserRule

        if (!rule.autofix) {
          unfixed.push(offense)

          continue
        }

        if (offense.autofixContext) {
          const originalNodeType = offense.autofixContext.node.type
          const location: Location = offense.autofixContext.node.location ? Location.from(offense.autofixContext.node.location) : offense.location

          const freshNode = findNodeByLocation(
            parseResult.value,
            location,
            (node) => node.type === originalNodeType
          )

          if (freshNode) {
            offense.autofixContext.node = freshNode
          } else {
            unfixed.push(offense)

            continue
          }
        }

        const fixedResult = rule.autofix(offense, parseResult, context)

        if (fixedResult) {
          fixed.push(offense)
        } else {
          unfixed.push(offense)
        }
      }

      if (fixed.length > 0) {
        const printer = new IdentityPrinter()
        currentSource = printer.print(parseResult.value)
      }
    }

    if (sourceOffenses.length > 0) {
      const sortedSourceOffenses = sourceOffenses.sort((a, b) => {
        if (a.location.start.line !== b.location.start.line) {
          return b.location.start.line - a.location.start.line
        }

        return b.location.start.column - a.location.start.column
      })

      for (const offense of sortedSourceOffenses) {
        const RuleClass = this.rules.find(rule => new rule().name === offense.rule)

        if (!RuleClass) {
          unfixed.push(offense)
          continue
        }

        const rule = new RuleClass() as SourceRule

        if (!rule.autofix) {
          unfixed.push(offense)
          continue
        }

        const correctedSource = rule.autofix(offense, currentSource, context)

        if (correctedSource) {
          currentSource = correctedSource
          fixed.push(offense)
        } else {
          unfixed.push(offense)
        }
      }
    }

    return {
      source: currentSource,
      fixed,
      unfixed
    }
  }
}
