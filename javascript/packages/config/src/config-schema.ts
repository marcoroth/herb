import { z } from "zod"

export const SeveritySchema = z.enum(["error", "warning", "info", "hint"])

export const FilesConfigSchema = z.object({
  extensions: z.array(z.string()).optional().describe("File extensions to match (e.g., ['.html.erb', '.rhtml'])"),
  patterns: z.array(z.string()).optional().describe("Custom glob patterns (e.g., ['views/**/*.xml'])"),
  exclude: z.array(z.string()).optional().describe("Glob patterns to exclude (e.g., ['node_modules/**/*', 'vendor/**/*'])"),
}).strict().optional()

const RuleConfigBaseSchema = z.object({
  enabled: z.boolean().optional().describe("Whether the rule is enabled"),
  severity: SeveritySchema.optional().describe("Severity level for the rule"),
})

export const RuleConfigSchema = RuleConfigBaseSchema.optional()

export const LinterConfigSchema = z.object({
  enabled: z.boolean().optional().describe("Whether the linter is enabled"),
  exclude: z.array(z.string()).optional().describe("Glob patterns to exclude from linting"),
  files: FilesConfigSchema.describe("File configuration for linter (overrides top-level)"),
  rules: z.record(z.string(), RuleConfigBaseSchema).optional().describe("Per-rule configuration"),
}).strict().optional()

export const FormatterConfigSchema = z.object({
  enabled: z.boolean().optional().describe("Whether the formatter is enabled"),
  exclude: z.array(z.string()).optional().describe("Glob patterns to exclude from formatting"),
  files: FilesConfigSchema.describe("File configuration for formatter (overrides top-level)"),
  indentWidth: z.number().int().positive().optional().describe("Number of spaces per indentation level"),
  maxLineLength: z.number().int().positive().optional().describe("Maximum line length before wrapping"),
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
