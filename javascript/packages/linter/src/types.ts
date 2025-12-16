import { Diagnostic, LexResult, ParseResult } from "@herb-tools/core"

import type { rules } from "./rules.js"
import type { Node } from "@herb-tools/core"
import type { RuleConfig } from "@herb-tools/config"
import type { Mutable } from "@herb-tools/rewriter"

export type { Mutable } from "@herb-tools/rewriter"

export type LintSeverity = "error" | "warning" | "info" | "hint"

export type FullRuleConfig = Required<Pick<RuleConfig, 'enabled' | 'severity'>> & Omit<RuleConfig, 'enabled' | 'severity'>

/**
 * Automatically inferred union type of all available linter rule names.
 * This type extracts the 'name' property from each rule class instance.
 */
export type LinterRule = InstanceType<typeof rules[number]>['name']


/**
 * Base context for autofix operations. Contains the offending node.
 * Rules can extend this interface to include rule-specific autofix data.
 * Note: The node is typed as Mutable to allow direct mutation in autofix methods.
 */
export interface BaseAutofixContext {
  /** The AST node, token, or data structure that caused the offense (mutable) */
  node: Mutable<Node>
}

/**
 * A lint offense without severity bound. Rules produce these, and the Linter
 * binds severity based on the rule's defaultConfig and user config overrides.
 */
export interface UnboundLintOffense<TAutofixContext extends BaseAutofixContext = BaseAutofixContext> extends Omit<Diagnostic, 'severity'> {
  rule: LinterRule
  /** Context data for autofix, including the offending node and rule-specific data */
  autofixContext?: TAutofixContext
}

/**
 * A lint offense with severity bound. The Linter produces these by binding
 * severity to UnboundLintOffenses based on rule configuration.
 */
export interface LintOffense<TAutofixContext extends BaseAutofixContext = BaseAutofixContext> extends UnboundLintOffense<TAutofixContext> {
  severity: LintSeverity
}

export interface LintResult<TAutofixContext extends BaseAutofixContext = BaseAutofixContext> {
  offenses: LintOffense<TAutofixContext>[]
  errors: number
  warnings: number
  info: number
  hints: number
  ignored: number
  wouldBeIgnored?: number
}

/**
 * Result of applying autofixes to source code
 */
export interface AutofixResult<TAutofixContext extends BaseAutofixContext = BaseAutofixContext> {
  /** The corrected source code with all fixes applied */
  source: string
  /** Offenses that were successfully fixed */
  fixed: LintOffense<TAutofixContext>[]
  /** Offenses that could not be automatically fixed */
  unfixed: LintOffense<TAutofixContext>[]
}

/**
 * Default configuration for rules when defaultConfig is not specified.
 * Custom rules can omit defaultConfig and will use these defaults.
 */
export const DEFAULT_RULE_CONFIG: FullRuleConfig = {
  enabled: true,
  severity: "error",
  exclude: []
}

/**
 * Base class for parser rules.
 */
export abstract class ParserRule<TAutofixContext extends BaseAutofixContext = BaseAutofixContext> {
  static type = "parser" as const
  /** Indicates whether this rule supports autofix. Defaults to false. */
  static autocorrectable = false
  abstract name: string

  get defaultConfig(): FullRuleConfig {
    return DEFAULT_RULE_CONFIG
  }
  abstract check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<TAutofixContext>[]

  /**
   * Optional method to determine if this rule should run.
   * If not implemented, rule is always enabled.
   * @param result - The parse result to analyze
   * @param context - Optional context for linting
   * @returns true if rule should run, false to skip
   */
  isEnabled?(result: ParseResult, context?: Partial<LintContext>): boolean

  /**
   * Optional method to automatically fix an offense by mutating the AST.
   * If not implemented, the rule does not support autofix.
   * @param offense - The offense to fix (includes autofixContext with node and rule-specific data)
   * @param result - The parse result containing the AST (mutate it directly and return it)
   * @param context - Optional context for linting
   * @returns The mutated ParseResult if fixed, or null if the offense could not be fixed
   */
  autofix?(offense: LintOffense<TAutofixContext>, result: ParseResult, context?: Partial<LintContext>): ParseResult | null
}

/**
 * Base class for lexer rules.
 */
export abstract class LexerRule<TAutofixContext extends BaseAutofixContext = BaseAutofixContext> {
  static type = "lexer" as const
  /** Indicates whether this rule supports autofix. Defaults to false. */
  static autocorrectable = false
  abstract name: string

  get defaultConfig(): FullRuleConfig {
    return DEFAULT_RULE_CONFIG
  }
  abstract check(lexResult: LexResult, context?: Partial<LintContext>): UnboundLintOffense<TAutofixContext>[]

  /**
   * Optional method to determine if this rule should run.
   * If not implemented, rule is always enabled.
   * @param lexResult - The lex result to analyze
   * @param context - Optional context for linting
   * @returns true if rule should run, false to skip
   */
  isEnabled?(lexResult: LexResult, context?: Partial<LintContext>): boolean

  /**
   * Optional method to automatically fix an offense by mutating tokens.
   * If not implemented, the rule does not support autofix.
   * @param offense - The offense to fix (includes autofixContext with node and rule-specific data)
   * @param lexResult - The lex result containing tokens (mutate them directly and return)
   * @param context - Optional context for linting
   * @returns The mutated LexResult if fixed, or null if the offense could not be fixed
   */
  autofix?(offense: LintOffense<TAutofixContext>, lexResult: LexResult, context?: Partial<LintContext>): LexResult | null
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
  validRuleNames: string[] | undefined
  ignoredOffensesByLine: Map<number, Set<string>> | undefined
  ignoreDisableComments: boolean | undefined
}

/**
 * Default context object with all keys defined but set to undefined
 */
export const DEFAULT_LINT_CONTEXT: LintContext = {
  fileName: undefined,
  validRuleNames: undefined,
  ignoredOffensesByLine: undefined,
  ignoreDisableComments: undefined
} as const

export abstract class SourceRule<TAutofixContext extends BaseAutofixContext = BaseAutofixContext> {
  static type = "source" as const
  /** Indicates whether this rule supports autofix. Defaults to false. */
  static autocorrectable = false
  abstract name: string

  get defaultConfig(): FullRuleConfig {
    return DEFAULT_RULE_CONFIG
  }
  abstract check(source: string, context?: Partial<LintContext>): UnboundLintOffense<TAutofixContext>[]

  /**
   * Optional method to determine if this rule should run.
   * If not implemented, rule is always enabled.
   * @param source - The source code to analyze
   * @param context - Optional context for linting
   * @returns true if rule should run, false to skip
   */
  isEnabled?(source: string, context?: Partial<LintContext>): boolean

  /**
   * Optional method to automatically fix an offense.
   * If not implemented, the rule does not support autofix.
   * @param offense - The offense to fix (includes autofixContext with node and rule-specific data)
   * @param source - The original source code
   * @param context - Optional context for linting
   * @returns The corrected source if the offense can be fixed, null otherwise
   */
  autofix?(offense: LintOffense<TAutofixContext>, source: string, context?: Partial<LintContext>): string | null
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
