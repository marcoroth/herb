import { Diagnostic, LexResult, ParseResult, Location } from "@herb-tools/core"
// Imported from the browser-safe `/schema` subpath: the `@herb-tools/config`
// root bundle imports node modules and cannot be bundled for the browser.
import { BUILT_IN_RULE_CONFIG_KEYS } from "@herb-tools/config/schema"

import type { ZodType } from "zod"
import type { rules } from "./rules.js"
import type { DiagnosticTag, HerbError, SourcePath } from "@herb-tools/core"
import type { HerbBackend, Node, ParserOptions } from "@herb-tools/core"
import type { AncestorChain, RenderGraph, PartialIndex } from "@herb-tools/analysis"
import type { DOMNodeLike } from "./browser/dom-to-ast.js"
import type { Framework, Environment, RuleConfig } from "@herb-tools/config"
import type { Mutable } from "@herb-tools/rewriter"
import type { RuleVersion } from "@herb-tools/core"

export type { Mutable } from "@herb-tools/rewriter"
export type { RuleVersion } from "@herb-tools/core"
export type { Framework, SeverityConfig, LinterMode } from "@herb-tools/config"
export { FRAMEWORKS, FRAMEWORK_NAMES } from "@herb-tools/config/schema"

export type LintSeverity = "error" | "warning" | "info" | "hint"


export const DEFAULT_LINTER_PARSER_OPTIONS: Partial<ParserOptions> = {
  track_whitespace: true,
}

// Built-in keys are listed explicitly instead of `Omit<RuleConfig, ...>`:
// Omit over RuleConfig's custom-option index signature (`[option: string]:
// unknown`, #1204) collapses to `{ [x: string]: unknown }`.
export type FullRuleConfig = Required<Pick<RuleConfig, 'enabled' | 'severity'>> & {
  frameworks?: Framework[]
  autoCorrect?: boolean
  include?: string[]
  only?: string[]
  exclude?: string[]
  environments?: Environment[]
}

/**
 * Base type for a rule's custom options (#1204). Option keys sit flat under
 * the rule name in `.herb.yml`, next to the built-in config keys, and are
 * camelCase by convention. Keys reserved for built-in rule behavior
 * (`BUILT_IN_RULE_CONFIG_KEYS`) are stripped before options are resolved.
 */
export type RuleOptions = Record<string, unknown>

/**
 * A single invalid rule option, recorded on the rule instance when
 * `static optionsSchema` validation fails. Empty when the options are valid.
 * This is the contract `Linter.validateRuleOptions` collects (#1204).
 */
export interface RuleOptionError {
  /** Attached by `Linter.validateRuleOptions`; unset on a rule instance's own `optionsErrors`. */
  ruleName?: string
  key?: string
  message: string
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/**
 * Deep-merge user options over a rule's `defaultOptions`, with arrays
 * replaced rather than concatenated. Mirrors `deepMerge` from
 * `@herb-tools/config` (not exported from its index) minus the
 * include/exclude special case, which never triggers here because those
 * reserved keys are filtered out before merging.
 */
function mergeRuleOptions<TOptions extends RuleOptions>(defaultOptions: TOptions, userOptions: Record<string, unknown>): TOptions {
  const output: Record<string, unknown> = { ...defaultOptions }

  for (const [key, userValue] of Object.entries(userOptions)) {
    if (userValue === undefined) continue

    const defaultValue = output[key]

    if (isPlainObject(userValue) && isPlainObject(defaultValue)) {
      output[key] = mergeRuleOptions(defaultValue, userValue)
    } else {
      output[key] = userValue
    }
  }

  return output as TOptions
}

/**
 * Automatically inferred union type of all available linter rule names.
 * This type extracts the 'ruleName' property from each rule class.
 */
export type LinterRule = (typeof rules[number])['ruleName']


/**
 * Base context for autofix operations. Contains the offending node.
 * Rules can extend this interface to include rule-specific autofix data.
 * Note: The node is typed as Mutable to allow direct mutation in autofix methods.
 */
export interface BaseAutofixContext {
  /** The AST node, token, or data structure that caused the offense (mutable) */
  node: Mutable<Node>
  /** If true, this fix requires --fix-unsafely to be applied */
  unsafe?: boolean
  /** Node type to match when re-finding the node in the re-parsed tree. Defaults to the type of `node` */
  nodeType?: string
}

/**
 * A lint offense without severity bound. Rules produce these, and the Linter
 * binds severity based on the rule's defaultConfig and user config overrides.
 */
export interface UnboundLintOffense<TAutofixContext extends BaseAutofixContext = BaseAutofixContext> extends Omit<Diagnostic, 'severity'> {
  rule: LinterRule
  /** Context data for autofix, including the offending node and rule-specific data */
  autofixContext?: TAutofixContext
  /** If set, overrides rule-level severity for this specific offense */
  severity?: LintSeverity
  /** The call chain that justified the offense */
  renderedFrom?: AncestorChain
  /** The template the offense was written in */
  file?: SourcePath
  /** The element the offense is about, when what was linted is a live DOM */
  element?: DOMNodeLike
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
  counterSuppressed?: number
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
 * Where a rule runs when neither the rule nor config says.
 *
 * The linter decides this, because it is the thing that runs rules. The config package only
 * records what a user asked for.
 * Config only has to know which names are valid.
 */
export const DEFAULT_ENVIRONMENT: Environment = "cli"

/**
 * Base class for parser rules.
 */
export abstract class ParserRule<TAutofixContext extends BaseAutofixContext = BaseAutofixContext, TOptions extends RuleOptions = Record<string, never>> {
  static type = "parser" as const
  static ruleName: string
  /** The version in which this rule was introduced. Used for version-gated rule filtering. */
  static introducedIn: RuleVersion
  /** The version in which this rule started being enabled by default. Falls back to `introducedIn`. */
  static defaultEnabledIn?: RuleVersion

  static version(version: RuleVersion): RuleVersion { return version }
  /** Indicates whether this rule supports autofix. Defaults to false. */
  static autocorrectable = false
  /** Indicates whether this rule supports unsafe autofix (requires --fix-unsafely). Defaults to false. */
  static unsafeAutocorrectable = false
  /** Indicates whether the source should be re-indented after autofix. Defaults to false. */
  static reindentAfterAutofix = false
  /** Indicates that `autofix` can only fix offenses that carry an `autofixContext`. Offenses without one are reported as not correctable. Defaults to false. */
  static autofixRequiresContext = false
  /** Indicates whether this rule consumes parser errors (like parser-no-errors). Rules with this flag are not skipped when parse results contain errors. */
  static consumesParserErrors = false
  /** Indicates that the rule reports about the project rather than the file, so a CLI run collapses its offenses down to the first one. Defaults to false. */
  static reportsOncePerRun = false
  /** Optional zod schema for the rule's custom options. When declared, merged user options are validated against it in `resolveOptions` (#1204). */
  static optionsSchema?: ZodType

  private resolvedOptions?: TOptions

  /**
   * Invalid custom option entries from the last `resolveOptions` call, when
   * the rule declares `static optionsSchema` and validation failed. Empty
   * when the options are valid. Collected by `Linter.validateRuleOptions`.
   */
  readonly optionsErrors: RuleOptionError[] = []

  get ruleName(): string {
    return (this.constructor as typeof ParserRule).ruleName
  }

  get defaultConfig(): FullRuleConfig {
    return DEFAULT_RULE_CONFIG
  }

  /**
   * The rule's default custom options. Rules that declare options override
   * this; keys must not collide with `BUILT_IN_RULE_CONFIG_KEYS`.
   */
  get defaultOptions(): TOptions {
    return {} as TOptions
  }

  /** The resolved custom options: `defaultOptions` until `resolveOptions` runs. */
  get options(): TOptions {
    return this.resolvedOptions ?? this.defaultOptions
  }

  /**
   * @internal Called by the Linter after instantiation to resolve the
   * user-configured options (`Config.getRuleOptions`). Reserved built-in
   * keys are dropped, the rest is deep-merged over `defaultOptions` (arrays
   * replaced), and the merged result is validated against `static
   * optionsSchema` when declared. On validation failure the rule keeps its
   * `defaultOptions` and records the zod issues on `optionsErrors`.
   */
  resolveOptions(userOptions: Record<string, unknown>): void {
    this.optionsErrors.length = 0

    const ruleOptions: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(userOptions)) {
      if (!(BUILT_IN_RULE_CONFIG_KEYS as readonly string[]).includes(key)) {
        ruleOptions[key] = value
      }
    }

    const optionsSchema = (this.constructor as typeof ParserRule).optionsSchema
    const merged = mergeRuleOptions(this.defaultOptions, ruleOptions)

    if (!optionsSchema) {
      this.resolvedOptions = merged

      return
    }

    const result = optionsSchema.safeParse(merged)

    if (result.success) {
      this.resolvedOptions = result.data as TOptions
    } else {
      this.resolvedOptions = this.defaultOptions

      for (const issue of result.error.issues) {
        this.optionsErrors.push({
          key: issue.path.length > 0 ? issue.path.join(".") : undefined,
          message: issue.message,
        })
      }
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return DEFAULT_LINTER_PARSER_OPTIONS
  }

  protected createOffense(message: string, location: Location, autofixContext?: TAutofixContext, severity?: LintSeverity, tags?: DiagnosticTag[]): UnboundLintOffense<TAutofixContext> {
    return {
      rule: this.ruleName,
      code: this.ruleName,
      source: "Herb Linter",
      message,
      location,
      autofixContext,
      severity,
      tags,
    }
  }

  protected herbErrorToLintOffense(error: HerbError): LintOffense {
    return {
      message: error.message,
      location: error.location,
      severity: error.severity,
      rule: this.ruleName,
      code: this.ruleName,
      source: "linter"
    }
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
export abstract class LexerRule<TAutofixContext extends BaseAutofixContext = BaseAutofixContext, TOptions extends RuleOptions = Record<string, never>> {
  static type = "lexer" as const
  static ruleName: string
  /** The version in which this rule was introduced. Used for version-gated rule filtering. */
  static introducedIn: RuleVersion
  /** The version in which this rule started being enabled by default. Falls back to `introducedIn`. */
  static defaultEnabledIn?: RuleVersion

  static version(version: RuleVersion): RuleVersion { return version }

  /** Indicates whether this rule supports autofix. Defaults to false. */
  static autocorrectable = false
  /** Indicates whether this rule supports unsafe autofix (requires --fix-unsafely). Defaults to false. */
  static unsafeAutocorrectable = false
  /** Indicates that `autofix` can only fix offenses that carry an `autofixContext`. Offenses without one are reported as not correctable. Defaults to false. */
  static autofixRequiresContext = false
  /** Optional zod schema for the rule's custom options. When declared, merged user options are validated against it in `resolveOptions` (#1204). */
  static optionsSchema?: ZodType

  private resolvedOptions?: TOptions

  /**
   * Invalid custom option entries from the last `resolveOptions` call, when
   * the rule declares `static optionsSchema` and validation failed. Empty
   * when the options are valid. Collected by `Linter.validateRuleOptions`.
   */
  readonly optionsErrors: RuleOptionError[] = []

  get ruleName(): string {
    return (this.constructor as typeof LexerRule).ruleName
  }

  get defaultConfig(): FullRuleConfig {
    return DEFAULT_RULE_CONFIG
  }

  /**
   * The rule's default custom options. Rules that declare options override
   * this; keys must not collide with `BUILT_IN_RULE_CONFIG_KEYS`.
   */
  get defaultOptions(): TOptions {
    return {} as TOptions
  }

  /** The resolved custom options: `defaultOptions` until `resolveOptions` runs. */
  get options(): TOptions {
    return this.resolvedOptions ?? this.defaultOptions
  }

  /**
   * @internal Called by the Linter after instantiation to resolve the
   * user-configured options (`Config.getRuleOptions`). Reserved built-in
   * keys are dropped, the rest is deep-merged over `defaultOptions` (arrays
   * replaced), and the merged result is validated against `static
   * optionsSchema` when declared. On validation failure the rule keeps its
   * `defaultOptions` and records the zod issues on `optionsErrors`.
   */
  resolveOptions(userOptions: Record<string, unknown>): void {
    this.optionsErrors.length = 0

    const ruleOptions: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(userOptions)) {
      if (!(BUILT_IN_RULE_CONFIG_KEYS as readonly string[]).includes(key)) {
        ruleOptions[key] = value
      }
    }

    const optionsSchema = (this.constructor as typeof LexerRule).optionsSchema
    const merged = mergeRuleOptions(this.defaultOptions, ruleOptions)

    if (!optionsSchema) {
      this.resolvedOptions = merged

      return
    }

    const result = optionsSchema.safeParse(merged)

    if (result.success) {
      this.resolvedOptions = result.data as TOptions
    } else {
      this.resolvedOptions = this.defaultOptions

      for (const issue of result.error.issues) {
        this.optionsErrors.push({
          key: issue.path.length > 0 ? issue.path.join(".") : undefined,
          message: issue.message,
        })
      }
    }
  }

  protected createOffense(message: string, location: Location, autofixContext?: TAutofixContext, severity?: LintSeverity, tags?: DiagnosticTag[]): UnboundLintOffense<TAutofixContext> {
    return {
      rule: this.ruleName,
      code: this.ruleName,
      source: "Herb Linter",
      message,
      location,
      autofixContext,
      severity,
      tags,
    }
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
  ruleName: string
  introducedIn: RuleVersion
  defaultEnabledIn?: RuleVersion
  autocorrectable?: boolean
  unsafeAutocorrectable?: boolean
  autofixRequiresContext?: boolean
  reportsOncePerRun?: boolean
  optionsSchema?: ZodType
}

/**
 * A single file-scoped `<%# herb:disable rule N|all %>` entry observed in the
 * source, indexed by rule name and reported to the meta-rules via LintContext.
 */
export interface HerbCounterCacheEntry {
  ruleName: string
  /** Suppression count. `"all"` means suppress every offense of this rule. */
  count: number | "all"
  line: number
  column: number
  raw: string
  countOffset: number
  countLength: number
}

/**
 * Per-rule reconciliation between a file-scoped `<%# herb:disable rule N %>`
 * entry (E) and the actual offense count for the file (N), placed on
 * LintContext so the out-of-date meta-rule can read it after the main rule
 * loop has run.
 *
 * `"all"` entries never trigger drift and are omitted from this map.
 */
export interface HerbCounterDrift {
  ruleName: string
  /** Declared expected count (E). Always a number; `"all"` entries are not tracked here. */
  expected: number
  /** Actual offense count (N) after herb:disable line-scope filtering */
  actual: number
  /** Location metadata of the enclosing herb:disable comment */
  line: number
  column: number
  raw: string
  /** Zero-based offset of the count token within `raw`, for autofix. */
  countOffset: number
  /** Length of the count token as it appears in `raw`. */
  countLength: number
  /**
   * Whether the rule ran for this file. A rule that is not enabled produces no
   * offenses to count, so its entry is reported but never autofixed.
   */
  measurable: boolean
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
  ignoreCounterComments: boolean | undefined
  counterDriftByRule: Map<string, HerbCounterDrift> | undefined  
  indentWidth: number | undefined
  indentStyle: "space" | "tab" | undefined
  framework: Framework | undefined
  environment: Environment | undefined
  partials: PartialIndex | undefined
  partialCallers: RenderGraph | undefined
  projectPath: string | undefined
  herb: HerbBackend | undefined
  parkedRoots: (() => ArrayLike<ParkedRoot>) | undefined
}

export interface ParkedRoot {
  querySelectorAll(selectors: string): ArrayLike<unknown>
}

/**
 * Default context object with all keys defined but set to undefined
 */
export const DEFAULT_LINT_CONTEXT: LintContext = {
  fileName: undefined,
  validRuleNames: undefined,
  ignoredOffensesByLine: undefined,
  ignoreDisableComments: undefined,
  counterDriftByRule: undefined,
  ignoreCounterComments: undefined,
  indentWidth: undefined,
  indentStyle: undefined,
  framework: undefined,
  environment: undefined,
  partials: undefined,
  partialCallers: undefined,
  projectPath: undefined,
  herb: undefined,
  parkedRoots: undefined
} as const

export abstract class SourceRule<TAutofixContext extends BaseAutofixContext = BaseAutofixContext, TOptions extends RuleOptions = Record<string, never>> {
  static type = "source" as const
  static ruleName: string
  /** The version in which this rule was introduced. Used for version-gated rule filtering. */
  static introducedIn: RuleVersion
  /** The version in which this rule started being enabled by default. Falls back to `introducedIn`. */
  static defaultEnabledIn?: RuleVersion

  static version(version: RuleVersion): RuleVersion { return version }

  /** Indicates whether this rule supports autofix. Defaults to false. */
  static autocorrectable = false
  /** Indicates whether this rule supports unsafe autofix (requires --fix-unsafely). Defaults to false. */
  static unsafeAutocorrectable = false
  /** Indicates that `autofix` can only fix offenses that carry an `autofixContext`. Offenses without one are reported as not correctable. Defaults to false. */
  static autofixRequiresContext = false
  /** Optional zod schema for the rule's custom options. When declared, merged user options are validated against it in `resolveOptions` (#1204). */
  static optionsSchema?: ZodType

  private resolvedOptions?: TOptions

  /**
   * Invalid custom option entries from the last `resolveOptions` call, when
   * the rule declares `static optionsSchema` and validation failed. Empty
   * when the options are valid. Collected by `Linter.validateRuleOptions`.
   */
  readonly optionsErrors: RuleOptionError[] = []

  get ruleName(): string {
    return (this.constructor as typeof SourceRule).ruleName
  }

  get defaultConfig(): FullRuleConfig {
    return DEFAULT_RULE_CONFIG
  }

  /**
   * The rule's default custom options. Rules that declare options override
   * this; keys must not collide with `BUILT_IN_RULE_CONFIG_KEYS`.
   */
  get defaultOptions(): TOptions {
    return {} as TOptions
  }

  /** The resolved custom options: `defaultOptions` until `resolveOptions` runs. */
  get options(): TOptions {
    return this.resolvedOptions ?? this.defaultOptions
  }

  /**
   * @internal Called by the Linter after instantiation to resolve the
   * user-configured options (`Config.getRuleOptions`). Reserved built-in
   * keys are dropped, the rest is deep-merged over `defaultOptions` (arrays
   * replaced), and the merged result is validated against `static
   * optionsSchema` when declared. On validation failure the rule keeps its
   * `defaultOptions` and records the zod issues on `optionsErrors`.
   */
  resolveOptions(userOptions: Record<string, unknown>): void {
    this.optionsErrors.length = 0

    const ruleOptions: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(userOptions)) {
      if (!(BUILT_IN_RULE_CONFIG_KEYS as readonly string[]).includes(key)) {
        ruleOptions[key] = value
      }
    }

    const optionsSchema = (this.constructor as typeof SourceRule).optionsSchema
    const merged = mergeRuleOptions(this.defaultOptions, ruleOptions)

    if (!optionsSchema) {
      this.resolvedOptions = merged

      return
    }

    const result = optionsSchema.safeParse(merged)

    if (result.success) {
      this.resolvedOptions = result.data as TOptions
    } else {
      this.resolvedOptions = this.defaultOptions

      for (const issue of result.error.issues) {
        this.optionsErrors.push({
          key: issue.path.length > 0 ? issue.path.join(".") : undefined,
          message: issue.message,
        })
      }
    }
  }

  protected createOffense(message: string, location: Location, autofixContext?: TAutofixContext, severity?: LintSeverity, tags?: DiagnosticTag[]): UnboundLintOffense<TAutofixContext> {
    return {
      rule: this.ruleName,
      code: this.ruleName,
      source: "Herb Linter",
      message,
      location,
      autofixContext,
      severity,
      tags,
    }
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
  ruleName: string
  introducedIn: RuleVersion
  defaultEnabledIn?: RuleVersion
  autocorrectable?: boolean
  unsafeAutocorrectable?: boolean
  autofixRequiresContext?: boolean
  reportsOncePerRun?: boolean
  optionsSchema?: ZodType
}

/**
 * Type representing a parser/AST rule class constructor.
 * The Linter accepts rule classes rather than instances for better performance and memory usage.
 * Parser rules are the default and don't require static properties.
 */
export type ParserRuleClass = (new () => ParserRule) & {
  type?: "parser"
  ruleName: string
  introducedIn: RuleVersion
  defaultEnabledIn?: RuleVersion
  autocorrectable?: boolean
  unsafeAutocorrectable?: boolean
  autofixRequiresContext?: boolean
  reindentAfterAutofix?: boolean
  consumesParserErrors?: boolean
  reportsOncePerRun?: boolean
  optionsSchema?: ZodType
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
