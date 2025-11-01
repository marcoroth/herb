import path from "path"

import { promises as fs } from "fs"
import { stringify, parse, parseDocument, isMap } from "yaml"
import { ZodError } from "zod"
import { fromZodError } from "zod-validation-error"
import { minimatch } from "minimatch"
import { glob } from "glob"

import { DiagnosticSeverity } from "@herb-tools/core"
import { HerbConfigSchema } from "./config-schema.js"
import { deepMerge } from "./merge.js"

import packageJson from "../package.json"
import configTemplate from "./config-template.yml"

const DEFAULT_VERSION = packageJson.version

export interface ConfigValidationError {
  message: string
  path: (string | number | symbol)[]
  code: string
  line?: number
  column?: number
  severity?: 'error' | 'warning'
}

export type FilesConfig = {
  include?: string[]
  exclude?: string[]
}

export type RuleConfig = {
  enabled?: boolean
  severity?: DiagnosticSeverity
  autoCorrect?: boolean
  include?: string[]
  only?: string[]
  exclude?: string[]
}

export type LinterConfig = {
  enabled?: boolean
  include?: string[]
  exclude?: string[]
  rules?: Record<string, RuleConfig>
}

export type FormatterConfig = {
  enabled?: boolean
  include?: string[]
  exclude?: string[]
  indentWidth?: number
  maxLineLength?: number
  rewriter?: {
    pre?: string[]
    post?: string[]
  }
}

export type HerbConfigOptions = {
  files?: FilesConfig
  linter?: LinterConfig
  formatter?: FormatterConfig
}

export type HerbConfig = HerbConfigOptions & {
  version: string
}

export type LoadOptions = {
  silent?: boolean
  version?: string
  createIfMissing?: boolean
  exitOnError?: boolean
}

export type FromObjectOptions = {
  projectPath?: string
  version?: string
}

export class Config {
  static configPath = ".herb.yml"

  private static PROJECT_INDICATORS = [
    '.git',
    'Gemfile',
    'package.json',
    'Rakefile',
    'README.md',
    '*.gemspec',
    'config/application.rb'
  ]

  public readonly path: string
  public config: HerbConfig

  constructor(projectPath: string, config: HerbConfig) {
    this.path = Config.configPathFromProjectPath(projectPath)
    this.config = config
  }

  get projectPath(): string {
    return path.dirname(this.path)
  }

  get version(): string {
    return this.config.version
  }

  get options(): HerbConfigOptions {
    return {
      files: this.config.files,
      linter: this.config.linter,
      formatter: this.config.formatter
    }
  }

  get linter() {
    return this.config.linter
  }

  get formatter() {
    return this.config.formatter
  }

  public toJSON() {
    return JSON.stringify(this.config, null, "  ")
  }

  /**
   * Check if the linter is enabled.
   * @returns true if linter is enabled (default), false if explicitly disabled
   */
  public get isLinterEnabled(): boolean {
    return this.config.linter?.enabled ?? Config.getDefaultConfig().linter?.enabled ?? true
  }

  /**
   * Check if the formatter is enabled.
   * @returns true if formatter is enabled (default), false if explicitly disabled
   */
  public get isFormatterEnabled(): boolean {
    return this.config.formatter?.enabled ?? Config.getDefaultConfig().formatter?.enabled ?? true
  }

  /**
   * Check if a specific rule is disabled.
   * @param ruleName - The name of the rule to check
   * @returns true if the rule is explicitly disabled, false otherwise
   */
  public isRuleDisabled(ruleName: string): boolean {
    return this.config.linter?.rules?.[ruleName]?.enabled === false
  }

  /**
   * Check if a specific rule is enabled.
   * @param ruleName - The name of the rule to check
   * @returns true if the rule is enabled, false otherwise
   */
  public isRuleEnabled(ruleName: string): boolean {
    return !this.isRuleDisabled(ruleName)
  }

  /**
   * Get the files configuration for a specific tool.
   * Tool-specific file config takes precedence over top-level config.
   * Include patterns are additive (defaults are already merged in this.config).
   * @param tool - The tool to get files config for ('linter' or 'formatter')
   * @returns The merged files configuration
   */
  public getFilesConfigForTool(tool: 'linter' | 'formatter'): FilesConfig {
    const toolConfig = tool === 'linter' ? this.config.linter : this.config.formatter
    const topLevelFiles = this.config.files || {}

    const topLevelInclude = topLevelFiles.include || []
    const toolInclude = toolConfig?.include || []
    const include = [...topLevelInclude, ...toolInclude]

    const exclude = toolConfig?.exclude || topLevelFiles.exclude || []

    return {
      include,
      exclude
    }
  }

  /**
   * Get the files configuration for the linter.
   * Linter-specific file config takes precedence over top-level config.
   * @returns The merged files configuration for linter
   */
  public get filesConfigForLinter(): FilesConfig {
    return this.getFilesConfigForTool('linter')
  }

  /**
   * Get the files configuration for the formatter.
   * Formatter-specific file config takes precedence over top-level config.
   * @returns The merged files configuration for formatter
   */
  public get filesConfigForFormatter(): FilesConfig {
    return this.getFilesConfigForTool('formatter')
  }

  /**
   * Find files for a specific tool based on its configuration.
   * Uses include patterns from config, applies exclude patterns.
   * @param tool - The tool to find files for ('linter' or 'formatter')
   * @param cwd - The directory to search from (defaults to project path)
   * @returns Promise resolving to array of absolute file paths
   */
  public async findFilesForTool(tool: 'linter' | 'formatter', cwd?: string): Promise<string[]> {
    const searchDir = cwd || path.dirname(this.path)
    const filesConfig = this.getFilesConfigForTool(tool)

    const patterns = filesConfig.include || []

    if (patterns.length === 0) {
      return []
    }

    return await glob(patterns, {
      cwd: searchDir,
      absolute: true,
      nodir: true,
      ignore: filesConfig.exclude || []
    })
  }

  /**
   * Find files for the linter based on linter configuration.
   * @param cwd - The directory to search from (defaults to project path)
   * @returns Promise resolving to array of absolute file paths
   */
  public async findFilesForLinter(cwd?: string): Promise<string[]> {
    return this.findFilesForTool('linter', cwd)
  }

  /**
   * Find files for the formatter based on formatter configuration.
   * @param cwd - The directory to search from (defaults to project path)
   * @returns Promise resolving to array of absolute file paths
   */
  public async findFilesForFormatter(cwd?: string): Promise<string[]> {
    return this.findFilesForTool('formatter', cwd)
  }

  /**
   * Check if a file path is excluded by glob patterns.
   * @param filePath - The file path to check
   * @param excludePatterns - Array of glob patterns to check against
   * @returns true if the path matches any exclude pattern
   */
  private isPathExcluded(filePath: string, excludePatterns?: string[]): boolean {
    if (!excludePatterns || excludePatterns.length === 0) {
      return false
    }

    return excludePatterns.some(pattern => minimatch(filePath, pattern))
  }

  /**
   * Check if a file path matches any of the include patterns.
   * @param filePath - The file path to check
   * @param includePatterns - Array of glob patterns to check against
   * @returns true if the path matches any include pattern, or true if no patterns specified
   */
  private isPathIncluded(filePath: string, includePatterns?: string[]): boolean {
    if (!includePatterns || includePatterns.length === 0) {
      return true
    }

    return includePatterns.some(pattern => minimatch(filePath, pattern))
  }

  /**
   * Check if a tool (linter or formatter) is enabled for a specific file path.
   * Respects both the tool's enabled state and its exclude patterns.
   * @param filePath - The file path to check
   * @param tool - The tool to check ('linter' or 'formatter')
   * @returns true if the tool is enabled for this path
   */
  public isEnabledForPath(filePath: string, tool: 'linter' | 'formatter'): boolean {
    const isEnabled = tool === 'linter' ? this.isLinterEnabled : this.isFormatterEnabled

    if (!isEnabled) {
      return false
    }

    const toolConfig = tool === 'linter' ? this.config.linter : this.config.formatter
    const excludePatterns = toolConfig?.exclude || []

    return !this.isPathExcluded(filePath, excludePatterns)
  }

  /**
   * Check if the linter is enabled for a specific file path.
   * Respects both linter.enabled and linter.exclude patterns.
   * @param filePath - The file path to check
   * @returns true if the linter is enabled for this path
   */
  public isLinterEnabledForPath(filePath: string): boolean {
    return this.isEnabledForPath(filePath, 'linter')
  }

  /**
   * Check if the formatter is enabled for a specific file path.
   * Respects both formatter.enabled and formatter.exclude patterns.
   * @param filePath - The file path to check
   * @returns true if the formatter is enabled for this path
   */
  public isFormatterEnabledForPath(filePath: string): boolean {
    return this.isEnabledForPath(filePath, 'formatter')
  }

  /**
   * Check if a specific rule is enabled for a specific file path.
   * Respects linter.enabled, linter.exclude, rule.enabled, rule.include, rule.only, and rule.exclude patterns.
   *
   * Pattern precedence:
   * - If rule.only is specified: Only files matching 'only' patterns (ignores all 'include' patterns)
   * - If rule.only is NOT specified: Files matching 'include' patterns (if specified, additive)
   * - rule.exclude is always applied regardless of 'only' or 'include'
   *
   * @param ruleName - The name of the rule to check
   * @param filePath - The file path to check
   * @returns true if the rule is enabled for this path
   */
  public isRuleEnabledForPath(ruleName: string, filePath: string): boolean {
    if (!this.isLinterEnabledForPath(filePath)) {
      return false
    }

    if (this.isRuleDisabled(ruleName)) {
      return false
    }

    const ruleConfig = this.config.linter?.rules?.[ruleName]
    const ruleOnlyPatterns = ruleConfig?.only || []
    const ruleIncludePatterns = ruleConfig?.include || []
    const ruleExcludePatterns = ruleConfig?.exclude || []

    if (ruleOnlyPatterns.length > 0) {
      if (!this.isPathIncluded(filePath, ruleOnlyPatterns)) {
        return false
      }
    } else if (ruleIncludePatterns.length > 0) {
      if (!this.isPathIncluded(filePath, ruleIncludePatterns)) {
        return false
      }
    }

    return !this.isPathExcluded(filePath, ruleExcludePatterns)
  }

  /**
   * Apply configured severity overrides to a lint offense.
   * Returns the configured severity if set, otherwise returns the original severity.
   */
  public getConfiguredSeverity(ruleName: string, defaultSeverity: DiagnosticSeverity): DiagnosticSeverity {
    const ruleConfig = this.config.linter?.rules?.[ruleName]

    if (ruleConfig && ruleConfig.severity) {
      return ruleConfig.severity
    }

    return defaultSeverity
  }

  /**
   * Apply severity overrides from config to an array of offenses.
   * Each offense must have a `rule` and `severity` property.
   */
  public applySeverityOverrides<T extends { rule: string; severity: DiagnosticSeverity }>(offenses: T[]): T[] {
    if (!this.config.linter?.rules) {
      return offenses
    }

    return offenses.map(offense => {
      const ruleConfig = this.config.linter?.rules?.[offense.rule]
      if (ruleConfig && ruleConfig.severity) {
        return { ...offense, severity: ruleConfig.severity }
      }
      return offense
    })
  }

  static configPathFromProjectPath(projectPath: string) {
    return path.join(projectPath, this.configPath)
  }

  /**
   * Get the default file patterns that Herb recognizes.
   * These are the default extensions/patterns used when no custom patterns are specified.
   * @returns Array of glob patterns for HTML+ERB files
   */
  static getDefaultFilePatterns(): string[] {
    return this.getDefaultConfig().files?.include || []
  }

  /**
   * Check if a .herb.yml config file exists at the given path.
   *
   * @param pathOrFile - Path to directory or explicit config file path
   * @returns True if .herb.yml exists at the location, false otherwise
   */
  static exists(pathOrFile: string): boolean {
    try {
      let configPath: string

      if (pathOrFile.endsWith(this.configPath)) {
        configPath = pathOrFile
      } else {
        configPath = this.configPathFromProjectPath(pathOrFile)
      }

      require('fs').statSync(configPath)

      return true
    } catch {
      return false
    }
  }

  /**
   * Read raw YAML content from a config file.
   * Handles both explicit .herb.yml paths and directory paths.
   *
   * @param pathOrFile - Path to .herb.yml file or directory containing it
   * @returns string - The raw YAML content
   */
  static readRawYaml(pathOrFile: string): string {
    const configPath = pathOrFile.endsWith(this.configPath)
      ? pathOrFile
      : this.configPathFromProjectPath(pathOrFile)

    return require('fs').readFileSync(configPath, 'utf-8')
  }

  /**
   * Load Herb configuration from a file or directory
   *
   * This is the main entry point for loading configuration. It:
   * 1. Discovers the config file by walking up the directory tree
   * 2. Reads and validates the config
   * 3. Merges with defaults for a fully resolved config
   * 4. Auto-creates default config if createIfMissing option is true
   * 5. Prints informative messages to console
   *
   * @param pathOrFile - File path, directory path, or any path to start search from
   * @param options - Loading options
   * @returns Promise<Config> - Fully resolved config instance
   */
  static async load(
    pathOrFile: string,
    options: LoadOptions = {}
  ): Promise<Config> {
    const { silent = false, version = DEFAULT_VERSION, createIfMissing = false, exitOnError = false } = options

    try {
      if (pathOrFile.endsWith(this.configPath)) {
        return await this.loadFromExplicitPath(pathOrFile, silent, version, exitOnError)
      }

      const { configPath, projectRoot } = await this.findConfigFile(pathOrFile)

      if (configPath) {
        return await this.loadFromPath(configPath, projectRoot, silent, version, exitOnError)
      } else if (createIfMissing) {
        return await this.createDefaultConfig(projectRoot, silent, version)
      } else {
        const defaults = this.getDefaultConfig(version)

        return new Config(projectRoot, defaults)
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`Failed to load Herb configuration: ${error}`)
    }
  }

  /**
   * Load config for editor/language server use (silent mode, no file creation).
   * This is a convenience method for the common pattern used in editors.
   *
   * @param pathOrFile - Directory path or explicit .herb.yml file path
   * @param version - Optional version string (defaults to package version)
   * @returns Config instance or throws on errors
   */
  static async loadForEditor(pathOrFile: string, version?: string): Promise<Config> {
    return await this.load(pathOrFile, {
      silent: true,
      version,
      createIfMissing: false,
      exitOnError: false
    })
  }

  /**
   * Load config for CLI use (may create file, show errors).
   * This is a convenience method for the common pattern used in CLI tools.
   *
   * @param pathOrFile - Directory path or explicit .herb.yml file path
   * @param version - Optional version string (defaults to package version)
   * @param createIfMissing - Whether to create config if missing (default: false)
   * @returns Config instance or throws on errors
   */
  static async loadForCLI(
    pathOrFile: string,
    version?: string,
    createIfMissing: boolean = false
  ): Promise<Config> {
    return await this.load(pathOrFile, {
      silent: false,
      version,
      createIfMissing,
      exitOnError: false
    })
  }

  /**
   * Mutate an existing config file by reading it, validating, merging with a mutation, and writing back.
   * This preserves the user's YAML file structure and only writes what's explicitly configured.
   *
   * @param configPath - Path to the .herb.yml file
   * @param mutation - Partial config to merge (e.g., { linter: { rules: { "rule-name": { enabled: false } } } })
   * @returns Promise<void>
   *
   * @example
   * // Disable a rule in .herb.yml
   * await Config.mutateConfigFile('/path/to/.herb.yml', {
   *   linter: {
   *     rules: {
   *       'html-img-require-alt': { enabled: false }
   *     }
   *   }
   * })
   */
  static async mutateConfigFile(
    configPath: string,
    mutation: Partial<HerbConfigOptions>
  ): Promise<void> {
    let yamlContent: string

    try {
      const existingContent = await fs.readFile(configPath, 'utf-8')

      if (Object.keys(mutation).length > 0) {
        const document = parseDocument(existingContent)

        const validation = HerbConfigSchema.safeParse(document.toJSON())

        if (!validation.success) {
          const readableError = fromZodError(validation.error)
          throw new Error(`Invalid config file at ${configPath}: ${readableError.message}`)
        }

        if (document.contents) {
          this.applyMutationToDocument(document.contents, mutation)

          if (!document.get('version')) {
            document.set('version', DEFAULT_VERSION)
          }
        }

        yamlContent = document.toString()
      } else {
        yamlContent = existingContent
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error
      }

      if (Object.keys(mutation).length === 0) {
        yamlContent = configTemplate.replace(
          /^version:\s*[\d.]+$/m,
          `version: ${DEFAULT_VERSION}`
        )
      } else {
        const defaults = this.getDefaultConfig(DEFAULT_VERSION)
        const updated = deepMerge(defaults, mutation) as HerbConfig

        yamlContent = stringify(updated, {
          indent: 2,
          lineWidth: 0,
          blockQuote: 'literal'
        })

        yamlContent = this.addYamlSpacing(yamlContent)
      }
    }

    await fs.writeFile(configPath, yamlContent, 'utf-8')
  }

  /**
   * Apply mutation to YAML content and return the mutated string (synchronous)
   * Useful for code actions and other scenarios where you need the mutated content
   * without writing to disk.
   *
   * @param yamlContent - The original YAML content (with comments)
   * @param mutation - The mutation to apply
   * @returns The mutated YAML content (with comments preserved)
   */
  static applyMutationToYamlString(
    yamlContent: string,
    mutation: Partial<HerbConfigOptions>
  ): string {
    const document = parseDocument(yamlContent)

    if (document.contents) {
      this.applyMutationToDocument(document.contents, mutation)
    }

    return document.toString()
  }

  /**
   * Create a new config file content with a mutation applied
   * Uses the default template with comments and applies the mutation
   *
   * @param mutation - The mutation to apply to the default config
   * @param version - The version to use (defaults to package version)
   * @returns The config file content as a YAML string
   */
  static createConfigYamlString(
    mutation: Partial<HerbConfigOptions>,
    version: string = DEFAULT_VERSION
  ): string {
    let yamlContent = configTemplate.replace(
      /^version:\s*[\d.]+$/m,
      `version: ${version}`
    )

    if (Object.keys(mutation).length > 0) {
      yamlContent = this.applyMutationToYamlString(yamlContent, mutation)
    }

    return yamlContent
  }

  /**
   * Apply mutation to a YAML document while preserving comments
   * Works recursively to handle nested objects
   */
  private static applyMutationToDocument(node: any, mutation: any): void {
    for (const key in mutation) {
      const value = mutation[key]

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        let nestedNode = node.get(key)

        if (!nestedNode || !isMap(nestedNode)) {
          node.set(key, {})
          nestedNode = node.get(key)
        }

        if (isMap(nestedNode)) {
          this.applyMutationToDocument(nestedNode, value)
        } else {
          node.set(key, value)
        }
      } else {
        node.set(key, value)
      }
    }
  }

  /**
   * Add spacing between top-level keys and nested rule keys in YAML
   */
  private static addYamlSpacing(yaml: string): string {
    const lines = yaml.split('\n')
    const result: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const prevLine = lines[i - 1]

      if (i > 0 && /^[a-z][\w-]*:/.test(line) && prevLine !== undefined) {
        if (!prevLine.trim().startsWith('version:') && prevLine.trim() !== '') {
          result.push('')
        }
      }

      if (/^    [a-z][\w-]*:/.test(line) && prevLine && /^      /.test(prevLine)) {
        result.push('')
      }

      result.push(line)
    }

    return result.join('\n')
  }

  /**
   * Create a Config instance from a partial config object
   *
   * Useful for testing and programmatic config creation.
   * Deep merges the partial config with defaults.
   *
   * @param partial - Partial config object
   * @param options - Options including projectPath and version
   * @returns Config instance with fully resolved config
   */
  static fromObject(
    partial: Partial<HerbConfigOptions>,
    options: FromObjectOptions = {}
  ): Config {
    const { projectPath = process.cwd(), version = DEFAULT_VERSION } = options
    const defaults = this.getDefaultConfig(version)
    const merged: HerbConfig = deepMerge(defaults, partial as any)

    try {
      HerbConfigSchema.parse(merged)
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error, {
          prefix: "Configuration validation error",
        })

        throw new Error(validationError.toString())
      }

      throw error
    }

    return new Config(projectPath, merged)
  }

  /**
   * Find config file by walking up directory tree
   *
   * @param startPath - Path to start searching from (file or directory)
   * @returns Object with configPath (if found) and projectRoot
   */
  private static async findConfigFile(
    startPath: string
  ): Promise<{ configPath: string | null, projectRoot: string }> {
    let currentPath = path.resolve(startPath)

    try {
      const stats = await fs.stat(currentPath)

      if (stats.isFile()) {
        currentPath = path.dirname(currentPath)
      }
    } catch {
      currentPath = path.resolve(process.cwd())
    }

    while (true) {
      const configPath = path.join(currentPath, this.configPath)

      try {
        await fs.access(configPath)

        return { configPath, projectRoot: currentPath }
      } catch {
        // Config not in this directory, continue
      }

      const isProjectRoot = await this.isProjectRoot(currentPath)

      if (isProjectRoot) {
        return { configPath: null, projectRoot: currentPath }
      }

      const parentPath = path.dirname(currentPath)

      if (parentPath === currentPath) {
        return { configPath: null, projectRoot: process.cwd() }
      }

      currentPath = parentPath
    }
  }

  /**
   * Check if a directory is a project root
   */
  private static async isProjectRoot(dirPath: string): Promise<boolean> {
    for (const indicator of this.PROJECT_INDICATORS) {
      try {
        await fs.access(path.join(dirPath, indicator))

        return true
      } catch {
        // Indicator not found, continue checking
      }
    }
    return false
  }

  /**
   * Load config from explicit path (from --config-file argument)
   */
  private static async loadFromExplicitPath(
    configPath: string,
    silent: boolean,
    version: string,
    exitOnError: boolean
  ): Promise<Config> {
    const resolvedPath = path.resolve(configPath)

    try {
      const stats = await fs.stat(resolvedPath)

      if (!stats.isFile()) {
        if (exitOnError) {
          console.error(`\n✗ Config path is not a file: ${resolvedPath}\n`)

          process.exit(1)
        } else {
          throw new Error(`Config path is not a file: ${resolvedPath}`)
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        if (exitOnError) {
          console.error(`\n✗ Config file not found: ${resolvedPath}\n`)

          process.exit(1)
        } else {
          throw new Error(`Config file not found: ${resolvedPath}`)
        }
      }

      throw error
    }

    const projectRoot = path.dirname(resolvedPath)
    const config = await this.readAndValidateConfig(resolvedPath, projectRoot, version, exitOnError)

    if (!silent) {
      console.error(`✓ Using Herb config file at ${resolvedPath}`)
    }

    return config
  }

  /**
   * Load config from discovered path
   */
  private static async loadFromPath(
    configPath: string,
    projectRoot: string,
    silent: boolean,
    version: string,
    exitOnError: boolean
  ): Promise<Config> {
    const config = await this.readAndValidateConfig(configPath, projectRoot, version, exitOnError)

    if (!silent) {
      console.error(`✓ Using Herb config file at ${configPath}`)
    }

    return config
  }

  /**
   * Create default config at project root
   */
  private static async createDefaultConfig(
    projectRoot: string,
    silent: boolean,
    version: string
  ): Promise<Config> {
    const yamlPath = path.join(projectRoot, '.herb.yaml')

    try {
      await fs.access(yamlPath)

      console.error(`\n✗ Found \`.herb.yaml\` file at ${yamlPath}`)
      console.error(`  Please rename it to \`.herb.yml\`\n`)

      process.exit(1)
    } catch {
      // File doesn't exist
    }

    const configPath = this.configPathFromProjectPath(projectRoot)

    try {
      await this.mutateConfigFile(configPath, {})

      if (!silent) {
        console.error(`✓ Created default configuration at ${configPath}`)
      }
    } catch (error) {
      if (!silent) {
        console.error(`⚠ Could not create config file at ${configPath}, using defaults in-memory`)
      }
    }

    const defaults = this.getDefaultConfig(version)

    return new Config(projectRoot, defaults)
  }

  /**
   * Validate config text without loading or exiting process
   * Used by language servers to show diagnostics
   * Returns empty array if valid, array of errors/warnings if invalid
   */
  static async validateConfigText(
    text: string,
    options?: {
      version?: string
      projectPath?: string
    }
  ): Promise<ConfigValidationError[]> {
    const errors: ConfigValidationError[] = []
    const version = options?.version
    const projectPath = options?.projectPath

    if (projectPath) {
      try {
        const yamlPath = path.join(projectPath, '.herb.yaml')
        await fs.access(yamlPath)

        errors.push({
          message: 'Found .herb.yaml file. Please rename to .herb.yml',
          path: [],
          code: 'wrong_file_extension',
          severity: 'warning',
          line: 0,
          column: 0
        })
      } catch {
        // .herb.yaml doesn't exist
      }
    }

    let parsed: any

    try {
      parsed = parse(text)
    } catch (error: any) {
      let line: number | undefined
      let column: number | undefined

      const errorMatch = error.message?.match(/at line (\d+), column (\d+)/)

      if (errorMatch) {
        line = parseInt(errorMatch[1]) - 1
        column = parseInt(errorMatch[2]) - 1
      }

      errors.push({
        message: error.message || 'Invalid YAML syntax',
        path: [],
        code: 'yaml_syntax_error',
        severity: 'error',
        line,
        column
      })

      return errors
    }

    if (parsed === null || parsed === undefined) {
      parsed = {}
    }

    if (version && parsed.version && parsed.version !== version) {
      errors.push({
        message: `Configuration version (${parsed.version}) doesn't match current version (${version}). Consider updating your configuration.`,
        path: ['version'],
        code: 'version_mismatch',
        severity: 'warning'
      })
    }

    if (!parsed.version) {
      parsed.version = version || '0.0.0'
    }

    try {
      HerbConfigSchema.parse(parsed)
    } catch (error) {
      if (error instanceof ZodError) {
        errors.push(...error.issues.map(issue => ({
          message: issue.message,
          path: issue.path,
          code: issue.code,
          severity: 'error' as const
        })))
      }
    }

    return errors
  }

  /**
   * Read, parse, and validate config file
   */
  private static async readAndValidateConfig(
    configPath: string,
    projectRoot: string,
    version: string,
    exitOnError: boolean = false
  ): Promise<Config> {
    try {
      const content = await fs.readFile(configPath, "utf8")

      let parsed: any
      try {
        parsed = parse(content)
      } catch (error) {
        if (exitOnError) {
          console.error(`\n✗ Invalid YAML syntax in ${configPath}`)

          if (error instanceof Error) {
            console.error(`  ${error.message}\n`)
          }
          process.exit(1)
        } else {
          throw new Error(`Invalid YAML syntax in ${configPath}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      if (parsed === null || parsed === undefined) {
        parsed = {}
      }

      if (!parsed.version) {
        parsed.version = version
      }

      try {
        HerbConfigSchema.parse(parsed)
      } catch (error) {
        if (error instanceof ZodError) {
          const validationError = fromZodError(error, {
            prefix: `Configuration errors in ${configPath}`,
          })

          if (exitOnError) {
            console.error(`\n✗ ${validationError.toString()}\n`)

            process.exit(1)
          } else {
            throw new Error(validationError.toString())
          }
        }

        throw error
      }

      if (parsed.version && parsed.version !== version) {
        console.error(`\n⚠️ Configuration version mismatch in ${configPath}`)
        console.error(`   Config version: ${parsed.version}`)
        console.error(`   Current version: ${version}`)
        console.error(`   Consider updating your .herb.yml file.\n`)
      }

      const defaults = this.getDefaultConfig(version)
      const resolved = deepMerge(defaults, parsed as Partial<HerbConfig>)

      resolved.version = version

      return new Config(projectRoot, resolved)
    } catch (error) {
      throw error
    }
  }

  /**
   * Get default configuration object
   */
  private static getDefaultConfig(version: string = DEFAULT_VERSION): HerbConfig {
    return {
      version,
      files: {
        include: [
          '**/*.html',
          '**/*.rhtml',
          '**/*.html.erb',
          '**/*.html+*.erb',
          '**/*.turbo_stream.erb'
        ],
        exclude: [
          'node_modules/**/*',
          'vendor/bundle/**/*',
          'coverage/**/*',
        ]
      },
      linter: {
        enabled: true,
        rules: {}
      },
      formatter: {
        enabled: true,
        indentWidth: 2,
        maxLineLength: 80
      }
    }
  }
}
