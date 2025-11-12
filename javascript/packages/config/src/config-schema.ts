import { z } from "zod"

export const SeveritySchema = z.enum(["error", "warning", "info", "hint"])

export const FilesConfigSchema = z.object({
  include: z.array(z.string()).optional().describe("Additional glob patterns to include beyond defaults (e.g., ['**/*.xml.erb', 'custom/**/*.html'])"),
  exclude: z.array(z.string()).optional().describe("Glob patterns to exclude (e.g., ['node_modules/**/*', 'vendor/**/*', '**/*.html.erb'])"),
}).strict().optional()

const RuleConfigBaseSchema = z.object({
  enabled: z.boolean().optional().describe("Whether the rule is enabled"),
  severity: SeveritySchema.optional().describe("Severity level for the rule"),
  include: z.array(z.string()).optional().describe("Additional glob patterns to include for this rule (additive, ignored when 'only' is present)"),
  only: z.array(z.string()).optional().describe("Only apply this rule to files matching these glob patterns (overrides all 'include' patterns)"),
  exclude: z.array(z.string()).optional().describe("Don't apply this rule to files matching these glob patterns"),
})

export const RuleConfigSchema = RuleConfigBaseSchema.optional()

export const LinterConfigSchema = z.object({
  enabled: z.boolean().optional().describe("Whether the linter is enabled"),
  include: z.array(z.string()).optional().describe("Additional glob patterns to include beyond defaults (e.g., ['**/*.xml.erb', 'custom/**/*.html'])"),
  exclude: z.array(z.string()).optional().describe("Glob patterns to exclude from linting"),
  rules: z.record(z.string(), RuleConfigBaseSchema).optional().describe("Per-rule configuration"),
}).strict().optional()

const RewriterConfigSchema = z.object({
  pre: z.array(z.string()).optional().describe("Pre-format rewriters to run (in order) before formatting the AST"),
  post: z.array(z.string()).optional().describe("Post-format rewriters to run (in order) after formatting the document"),
}).strict().optional()

export const FormatterConfigSchema = z.object({
  enabled: z.boolean().optional().describe("Whether the formatter is enabled"),
  include: z.array(z.string()).optional().describe("Additional glob patterns to include beyond defaults (e.g., ['**/*.xml.erb', 'custom/**/*.html'])"),
  exclude: z.array(z.string()).optional().describe("Glob patterns to exclude from formatting"),
  indentWidth: z.number().int().positive().optional().describe("Number of spaces per indentation level"),
  maxLineLength: z.number().int().positive().optional().describe("Maximum line length before wrapping"),
  rewriter: RewriterConfigSchema.describe("Rewriter configuration for pre and post-format transformations"),
}).strict().optional()

export const HerbConfigSchema = z.object({
  version: z.string().describe("Configuration file version"),
  files: FilesConfigSchema.describe("Top-level file configuration"),
  linter: LinterConfigSchema,
  formatter: FormatterConfigSchema,
}).strict()

export type HerbConfigSchemaType = z.infer<typeof HerbConfigSchema>
export type RuleConfigSchemaType = z.infer<typeof RuleConfigSchema>
export type FilesConfigSchemaType = z.infer<typeof FilesConfigSchema>
export type SeveritySchemaType = z.infer<typeof SeveritySchema>
