import path from "path"

import { promises as fs } from "fs"
import { stringify, parse, parseDocument, isMap } from "yaml"
import { ZodError } from "zod"
import { fromZodError } from "zod-validation-error"

import { DiagnosticSeverity } from "@herb-tools/core"
import { HerbConfigSchema } from "./config-schema.js"
import { deepMerge } from "./merge.js"

import packageJson from "../package.json"
import configTemplate from "./config-template.yml"

const DEFAULT_VERSION = packageJson.version
const CONFIG_FILE_TEMPLATE = configTemplate

export interface ConfigValidationError {
  message: string
  path: (string | number | symbol)[]
  code: string
  line?: number
  column?: number
  severity?: 'error' | 'warning'
}

export type FilesConfig = {
  extensions?: string[]
  patterns?: string[]
  exclude?: string[]
}

export type RuleConfig = FilesConfig & {
  enabled?: boolean
  severity?: DiagnosticSeverity
  autoCorrect?: boolean
}

export type LinterConfig = {
  enabled?: boolean
  exclude?: string[]
  files?: FilesConfig
  rules?: Record<string, RuleConfig>
}

export type FormatterConfig = {
  enabled?: boolean
  exclude?: string[]
  files?: FilesConfig
  indentWidth?: number
  maxLineLength?: number
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

  static DEFAULT_EXTENSIONS = [
    '.html',
    '.rhtml',
    '.html.erb',
    '.html+*.erb',
    '.turbo_stream.erb'
  ]

  private static PROJECT_INDICATORS = [
    '.git',
    'Gemfile',
    'package.json',
    'Rakefile',
    'README.md',
    'config/application.rb'
  ]

  public readonly path: string
  public config: HerbConfig

  constructor(projectPath: string, config: HerbConfig) {
    this.path = Config.configPathFromProjectPath(projectPath)
    this.config = config
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

  /**
   * Generate glob pattern for a specific tool
   * Priority: tool.files > top-level files > defaults
   */
  getGlobPattern(tool: 'linter' | 'formatter'): string {
    const toolExtensions = this.config[tool]?.files?.extensions
    const topLevelExtensions = this.config.files?.extensions
    const extensions = toolExtensions || topLevelExtensions

    const toolPatterns = this.config[tool]?.files?.patterns
    const topLevelPatterns = this.config.files?.patterns
    const configPatterns = toolPatterns || topLevelPatterns

    if (!extensions || (!extensions?.length && !configPatterns?.length)) {
      return this.generateGlobFromExtensions(Config.DEFAULT_EXTENSIONS)
    }

    const patterns: string[] = []

    if (extensions && extensions.length > 0) {
      patterns.push(this.generateGlobFromExtensions(extensions))
    }

    if (configPatterns && configPatterns.length > 0) {
      patterns.push(...configPatterns)
    }

    if (patterns.length === 1) {
      return patterns[0]
    }

    return `{${patterns.join(',')}}`
  }

  /**
   * Get exclude patterns for a specific tool
   * Priority: tool.exclude > tool.files.exclude > top-level files.exclude > empty array
   */
  getExcludePatterns(tool: 'linter' | 'formatter'): string[] {
    const toolDirectExcludes = this.config[tool]?.exclude
    const toolFilesExcludes = this.config[tool]?.files?.exclude
    const topLevelExcludes = this.config.files?.exclude

    if (toolDirectExcludes && toolDirectExcludes?.length > 0) {
      return toolDirectExcludes
    }

    if (toolFilesExcludes && toolFilesExcludes?.length > 0) {
      return toolFilesExcludes
    }

    if (topLevelExcludes && topLevelExcludes.length > 0) {
      return topLevelExcludes
    }

    return []
  }

  private generateGlobFromExtensions(extensions: string[]): string {
    const cleaned = extensions.map(extension =>
      extension.startsWith('.') ? extension.slice(1) : extension
    )

    if (cleaned.length === 1) {
      return `**/*.${cleaned[0]}`
    }

    return `**/*.{${cleaned.join(',')}}`
  }

  public toJSON() {
    return JSON.stringify(this.config, null, "  ")
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

  updateVersionIfDifferent(currentVersion: string): boolean {
    if (this.config.version !== currentVersion) {
      this.config.version = currentVersion

      return true
    }

    return false
  }

  async read() {
    return await fs.readFile(this.path, "utf8")
  }

  static configPathFromProjectPath(projectPath: string) {
    return path.join(projectPath, this.configPath)
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
        yamlContent = CONFIG_FILE_TEMPLATE.replace(
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
    let yamlContent = CONFIG_FILE_TEMPLATE.replace(
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
        extensions: Config.DEFAULT_EXTENSIONS,
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
