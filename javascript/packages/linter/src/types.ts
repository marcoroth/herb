import { Diagnostic, LexResult, ParseResult } from "@herb-tools/core"
import type { defaultRules } from "./default-rules.js"

export type LintSeverity = "error" | "warning" | "info" | "hint"

/**
 * Automatically inferred union type of all available linter rule names.
 * This type extracts the 'name' property from each rule class instance.
 */
export type LinterRule = InstanceType<typeof defaultRules[number]>['name']

export interface LintOffense extends Diagnostic {
  rule: LinterRule
  severity: LintSeverity
}

export interface LintResult {
  offenses: LintOffense[]
  errors: number
  warnings: number
}

export abstract class ParserRule {
  static type = "parser" as const
  abstract name: string
  abstract check(result: ParseResult, context?: Partial<LintContext>): LintOffense[]
  
  /**
   * Optional method to determine if this rule should run.
   * If not implemented, rule is always enabled.
   * @param result - The parse result to analyze
   * @param context - Optional context for linting
   * @returns true if rule should run, false to skip
   */
  isEnabled?(result: ParseResult, context?: Partial<LintContext>): boolean
}

export abstract class LexerRule {
  static type = "lexer" as const
  abstract name: string
  abstract check(lexResult: LexResult, context?: Partial<LintContext>): LintOffense[]
  
  /**
   * Optional method to determine if this rule should run.
   * If not implemented, rule is always enabled.
   * @param lexResult - The lex result to analyze
   * @param context - Optional context for linting
   * @returns true if rule should run, false to skip
   */
  isEnabled?(lexResult: LexResult, context?: Partial<LintContext>): boolean
}

export interface LexerRuleConstructor {
  type: "lexer"
  new (): LexerRule
}

/**
 * Complete lint context with all properties defined.
 * Use Partial<LintContext> when passing context to rules.
 */
export interface LintContext {
  fileName: string | undefined
}

/**
 * Default context object with all keys defined but set to undefined
 */
export const DEFAULT_LINT_CONTEXT: LintContext = {
  fileName: undefined
} as const

export abstract class SourceRule {
  static type = "source" as const
  abstract name: string
  abstract check(source: string, context?: Partial<LintContext>): LintOffense[]
  
  /**
   * Optional method to determine if this rule should run.
   * If not implemented, rule is always enabled.
   * @param source - The source code to analyze
   * @param context - Optional context for linting
   * @returns true if rule should run, false to skip
   */
  isEnabled?(source: string, context?: Partial<LintContext>): boolean
}

export interface SourceRuleConstructor {
  type: "source"
  new (): SourceRule
}

/**
 * Type representing a parser/AST rule class constructor.
 * The Linter accepts rule classes rather than instances for better performance and memory usage.
 * Parser rules are the default and don't require static properties.
 */
export type ParserRuleClass = (new () => ParserRule) & {
  type?: "parser"
}

export type LexerRuleClass = LexerRuleConstructor
export type SourceRuleClass = SourceRuleConstructor

/**
 * Union type for any rule instance (Parser/AST, Lexer, or Source)
 */
export type Rule = ParserRule | LexerRule | SourceRule

/**
 * Union type for any rule class (Parser/AST, Lexer, or Source)
 */
export type RuleClass = ParserRuleClass | LexerRuleClass | SourceRuleClass
