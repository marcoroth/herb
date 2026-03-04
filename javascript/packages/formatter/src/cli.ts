import dedent from "dedent"
import { readFileSync, writeFileSync, statSync, existsSync } from "fs"
import { glob } from "tinyglobby"
import { resolve, relative } from "path"

import { Herb } from "@herb-tools/node-wasm"
import { Config, addHerbExtensionRecommendation, getExtensionsJsonRelativePath } from "@herb-tools/config"
import { colorize } from "@herb-tools/highlighter"

import { Formatter } from "./formatter.js"
import { ASTRewriter, StringRewriter, CustomRewriterLoader, builtinRewriters, isASTRewriterClass, isStringRewriterClass } from "@herb-tools/rewriter/loader"
import { parseArgs } from "util"

import { name, version, dependencies } from "../package.json"

const pluralize = (count: number, singular: string, plural: string = singular + 's'): string => {
  return count === 1 ? singular : plural
}

export class CLI {
  protected projectPath: string = process.cwd()

  protected determineProjectPath(patterns: string[]): void {
    const pattern = patterns[0]

    if (pattern && pattern !== '-') {
      const resolvedPattern = resolve(pattern)

      if (existsSync(resolvedPattern)) {
        this.projectPath = Config.findProjectRootSync(resolvedPattern)
      } else {
        const baseDir = pattern.split(/[*?{[\]]/)[0].replace(/\/$/, '')

        if (baseDir && existsSync(baseDir)) {
          this.projectPath = Config.findProjectRootSync(resolve(baseDir))
        }
      }
    }
  }

  private usage = dedent`
    Usage: herb-format [files|directories|glob-patterns...] [options]

    Arguments:
      files|directories|glob-patterns  Files, directories, or glob patterns to format, or '-' for stdin
                                       Multiple arguments are supported (e.g., herb-format file1.erb file2.erb dir/)
                                       Omit to format all configured files in current directory

    Options:
      -c, --check                     check if files are formatted without modifying them
      -h, --help                      show help
      -v, --version                   show version
      --init                          create a .herb.yml configuration file in the current directory
      --config-file <path>            explicitly specify path to .herb.yml config file
      --force                         force formatting even if disabled in .herb.yml
      --indent-width <number>         number of spaces per indentation level (default: 2)
      --max-line-length <number>      maximum line length before wrapping (default: 80)

    Examples:
      herb-format                                 # Format all configured files in current directory
      herb-format index.html.erb                  # Format and write single file
      herb-format templates/index.html.erb        # Format and write single file
      herb-format templates/                      # Format all configured files within the given directory
      herb-format "templates/**/*.html.erb"       # Format all \`**/*.html.erb\` files in the templates/ directory
      herb-format "**/*.html.erb"                 # Format all \`*.html.erb\` files using glob pattern
      herb-format "**/*.xml.erb"                  # Format all \`*.xml.erb\` files using glob pattern

      herb-format --check                         # Check if all configured files are formatted
      herb-format --check templates/              # Check if all configured files in templates/ are formatted

      herb-format --force                         # Format even if disabled in project config
      herb-format --indent-width 4                # Format with 4-space indentation
      herb-format --max-line-length 100           # Format with 100-character line limit
      cat template.html.erb | herb-format         # Format from stdin to stdout
  `

  private parseArguments() {
    const { values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: {
        help: { type: "boolean", short: "h" },
        force: { type: "boolean" },
        version: { type: "boolean", short: "v" },
        check: { type: "boolean", short: "c" },
        init: { type: "boolean" },
        "config-file": { type: "string" },
        "indent-width": { type: "string" },
        "max-line-length": { type: "string" }
      },
      allowPositionals: true
    })

    if (values.help) {
      console.log(this.usage)
      process.exit(0)
    }

    let indentWidth: number | undefined

    if (values["indent-width"]) {
      const parsed = parseInt(values["indent-width"], 10)
      if (isNaN(parsed) || parsed < 1) {
        console.error(
          `Invalid indent-width: ${values["indent-width"]}. Must be a positive integer.`,
        )
        process.exit(1)
      }
      indentWidth = parsed
    }

    let maxLineLength: number | undefined

    if (values["max-line-length"]) {
      const parsed = parseInt(values["max-line-length"], 10)
      if (isNaN(parsed) || parsed < 1) {
        console.error(
          `Invalid max-line-length: ${values["max-line-length"]}. Must be a positive integer.`,
        )
        process.exit(1)
      }
      maxLineLength = parsed
    }

    return {
      positionals,
      isCheckMode: values.check,
      isVersionMode: values.version,
      isForceMode: values.force,
      isInitMode: values.init,
      configFile: values["config-file"],
      indentWidth,
      maxLineLength
    }
  }

  async run() {
    const { positionals, isCheckMode, isVersionMode, isForceMode, isInitMode, configFile, indentWidth, maxLineLength } = this.parseArguments()

    try {
      await Herb.load()

      if (isVersionMode) {
        console.log("Versions:")
        console.log(`  ${name}@${version}`)
        console.log(`  @herb-tools/printer@${dependencies['@herb-tools/printer']}`)
        console.log(`  ${Herb.version}`.split(", ").join("\n  "))

        process.exit(0)
      }

      if (positionals.includes('-') && positionals.length > 1) {
        console.error("Error: Cannot mix stdin ('-') with file arguments")
        process.exit(1)
      }

      this.determineProjectPath(positionals)

      const file = positionals[0]

      if (isInitMode) {
        const configPath = configFile || this.projectPath

        if (Config.exists(configPath)) {
          const fullPath = configFile || Config.configPathFromProjectPath(this.projectPath)
          console.log(`\n✗ Configuration file already exists at ${fullPath}`)
          console.log(`  Use --config-file to specify a different location.\n`)
          process.exit(1)
        }

        const config = await Config.loadForCLI(configPath, version, true)

        await Config.mutateConfigFile(config.path, {
          formatter: {
            enabled: true
          }
        })

        const initProjectPath = configFile ? resolve(configFile) : this.projectPath
        const projectDir = statSync(initProjectPath).isDirectory() ? initProjectPath : resolve(initProjectPath, '..')
        const extensionAdded = addHerbExtensionRecommendation(projectDir)

        console.log(`\n✓ Configuration initialized at ${config.path}`)

        if (extensionAdded) {
          console.log(`✓ VSCode extension recommended in ${getExtensionsJsonRelativePath()}`)
        }

        console.log(`  Formatter is enabled by default.`)
        console.log(`  Edit this file to customize linter and formatter settings.\n`)

        process.exit(0)
      }

      const config = await Config.loadForCLI(configFile || this.projectPath, version)
      const hasConfigFile = Config.exists(config.projectPath)
      const formatterConfig = config.formatter || {}

      if (hasConfigFile && formatterConfig.enabled === false && !isForceMode) {
        console.log("Formatter is disabled in .herb.yml configuration.")
        console.log("To enable formatting, set formatter.enabled: true in .herb.yml")
        console.log("Or use --force to format anyway.")

        process.exit(0)
      }

      if (isForceMode && hasConfigFile && formatterConfig.enabled === false) {
        console.error("⚠️  Forcing formatter run (disabled in .herb.yml)")
        console.error()
      }

      console.error("⚠️  Experimental Preview: The formatter is in early development. Please report any unexpected behavior or bugs to https://github.com/marcoroth/herb/issues/new?template=formatting-issue.md")
      console.error()

      if (indentWidth !== undefined) {
        formatterConfig.indentWidth = indentWidth
      }

      if (maxLineLength !== undefined) {
        formatterConfig.maxLineLength = maxLineLength
      }

      const preRewriters: ASTRewriter[] = []
      const postRewriters: StringRewriter[] = []
      const rewriterNames = { pre: formatterConfig.rewriter?.pre || [], post: formatterConfig.rewriter?.post || [] }

      if (formatterConfig.rewriter && (rewriterNames.pre.length > 0 || rewriterNames.post.length > 0)) {
        const baseDir = config.projectPath || process.cwd()
        const warnings: string[] = []
        const allRewriterClasses: any[] = []

        allRewriterClasses.push(...builtinRewriters)

        const loader = new CustomRewriterLoader({ baseDir })
        const { rewriters: customRewriters, rewriterInfo, duplicateWarnings } = await loader.loadRewritersWithInfo()

        if (customRewriters.length > 0) {
          console.error(colorize(`\nLoaded ${customRewriters.length} custom ${pluralize(customRewriters.length, 'rewriter')}:`, "green"))

          for (const { name, path } of rewriterInfo) {
            const relativePath = config.projectPath ? path.replace(config.projectPath + '/', '') : path

            console.error(colorize(`  • ${name}`, "cyan") + colorize(` (${relativePath})`, "dim"))
          }

          console.error()
        }

        allRewriterClasses.push(...customRewriters)
        warnings.push(...duplicateWarnings)

        const rewriterMap = new Map<string, any>()
        for (const RewriterClass of allRewriterClasses) {
          const instance = new RewriterClass()

          if (rewriterMap.has(instance.name)) {
            warnings.push(`Rewriter "${instance.name}" is defined multiple times. Using the last definition.`)
          }

          rewriterMap.set(instance.name, RewriterClass)
        }

        for (const name of rewriterNames.pre) {
          const RewriterClass = rewriterMap.get(name)

          if (!RewriterClass) {
            warnings.push(`Pre-format rewriter "${name}" not found. Skipping.`)
            continue
          }

          if (!isASTRewriterClass(RewriterClass)) {
            warnings.push(`Rewriter "${name}" is not a pre-format rewriter. Skipping.`)

            continue
          }

          const instance = new RewriterClass()
          try {
            await instance.initialize({ baseDir })
            preRewriters.push(instance)
          } catch (error) {
            warnings.push(`Failed to initialize pre-format rewriter "${name}": ${error}`)
          }
        }

        for (const name of rewriterNames.post) {
          const RewriterClass = rewriterMap.get(name)

          if (!RewriterClass) {
            warnings.push(`Post-format rewriter "${name}" not found. Skipping.`)

            continue
          }

          if (!isStringRewriterClass(RewriterClass)) {
            warnings.push(`Rewriter "${name}" is not a post-format rewriter. Skipping.`)

            continue
          }

          const instance = new RewriterClass()

          try {
            await instance.initialize({ baseDir })

            postRewriters.push(instance)
          } catch (error) {
            warnings.push(`Failed to initialize post-format rewriter "${name}": ${error}`)
          }
        }

        if (preRewriters.length > 0 || postRewriters.length > 0) {
          const customRewriterPaths = new Map(rewriterInfo.map(r => [r.name, r.path]))

          if (preRewriters.length > 0) {
            console.error(colorize(`\nUsing ${preRewriters.length} pre-format ${pluralize(preRewriters.length, 'rewriter')}:`, "green"))

            for (const rewriter of preRewriters) {
              const customPath = customRewriterPaths.get(rewriter.name)

              if (customPath) {
                const relativePath = config.projectPath ? customPath.replace(config.projectPath + '/', '') : customPath
                console.error(colorize(`  • ${rewriter.name}`, "cyan") + colorize(` (${relativePath})`, "dim"))
              } else {
                console.error(colorize(`  • ${rewriter.name}`, "cyan") + colorize(` (built-in)`, "dim"))
              }
            }

            console.error()
          }

          if (postRewriters.length > 0) {
            console.error(colorize(`\nUsing ${postRewriters.length} post-format ${pluralize(postRewriters.length, 'rewriter')}:`, "green"))

            for (const rewriter of postRewriters) {
              const customPath = customRewriterPaths.get(rewriter.name)

              if (customPath) {
                const relativePath = config.projectPath ? customPath.replace(config.projectPath + '/', '') : customPath
                console.error(colorize(`  • ${rewriter.name}`, "cyan") + colorize(` (${relativePath})`, "dim"))
              } else {
                console.error(colorize(`  • ${rewriter.name}`, "cyan") + colorize(` (built-in)`, "dim"))
              }
            }

            console.error()
          }
        }

        if (warnings.length > 0) {
          warnings.forEach(warning => console.error(`⚠️  ${warning}`))
          console.error()
        }
      }

      const formatter = Formatter.from(Herb, config, { preRewriters, postRewriters })

      if (!file && !process.stdin.isTTY) {
        if (isCheckMode) {
          console.error("Error: --check mode is not supported with stdin")

          process.exit(1)
        }

        const source = await this.readStdin()
        const result = formatter.format(source)
        const output = result.endsWith('\n') ? result : result + '\n'

        process.stdout.write(output)
      } else if (file === "-") {
        if (isCheckMode) {
          console.error("Error: --check mode is not supported with stdin")

          process.exit(1)
        }

        const source = await this.readStdin()
        const result = formatter.format(source)
        const output = result.endsWith('\n') ? result : result + '\n'

        process.stdout.write(output)
      } else if (positionals.length > 0) {
        const allFiles: string[] = []

        let hasErrors = false

        for (const pattern of positionals) {
          try {
            const files = await this.resolvePatternToFiles(pattern, config, isForceMode)

            if (files.length === 0) {
              const isLikelySpecificFile = !pattern.includes('*') && !pattern.includes('?') &&
                                           !pattern.includes('[') && !pattern.includes('{')

              if (isLikelySpecificFile) {
                continue
              } else {
                console.log(`No files found matching pattern: ${pattern}`)
                process.exit(0)
              }
            }

            allFiles.push(...files)
          } catch (error: any) {
            console.error(`Error: ${error.message}`)
            hasErrors = true
            break
          }
        }

        if (hasErrors) {
          process.exit(1)
        }

        const files = [...new Set(allFiles)]

        if (files.length === 0) {
          console.log(`No files found matching patterns: ${positionals.join(', ')}`)
          process.exit(0)
        }

        let formattedCount = 0
        const unformattedFiles: string[] = []

        for (const filePath of files) {
          const displayPath = relative(process.cwd(), filePath)

          try {
            const source = readFileSync(filePath, "utf-8")
            const result = formatter.format(source)
            const output = result.endsWith('\n') ? result : result + '\n'

            if (output !== source) {
              if (isCheckMode) {
                unformattedFiles.push(displayPath)
              } else {
                writeFileSync(filePath, output, "utf-8")
                console.log(`Formatted: ${displayPath}`)
              }
              formattedCount++
            }
          } catch (error) {
            console.error(`Error formatting ${displayPath}:`, error)
          }
        }

        if (isCheckMode) {
          if (unformattedFiles.length > 0) {
            console.log(`\nThe following ${pluralize(unformattedFiles.length, 'file is', 'files are')} not formatted:`)
            unformattedFiles.forEach(file => console.log(`  ${file}`))
            console.log(`\nChecked ${files.length} ${pluralize(files.length, 'file')}, found ${unformattedFiles.length} unformatted ${pluralize(unformattedFiles.length, 'file')}`)
            process.exit(1)
          } else {
            console.log(`\nChecked ${files.length} ${pluralize(files.length, 'file')}, all files are properly formatted`)
          }
        } else {
          console.log(`\nChecked ${files.length} ${pluralize(files.length, 'file')}, formatted ${formattedCount} ${pluralize(formattedCount, 'file')}`)
        }

        process.exit(0)
      } else {
        const files = await config.findFilesForTool('formatter', process.cwd())

        if (files.length === 0) {
          console.log(`No files found matching configured patterns`)

          process.exit(0)
        }

        let formattedCount = 0
        const unformattedFiles: string[] = []

        for (const filePath of files) {
          const displayPath = relative(process.cwd(), filePath)

          try {
            const source = readFileSync(filePath, "utf-8")
            const result = formatter.format(source)
            const output = result.endsWith('\n') ? result : result + '\n'

            if (output !== source) {
              if (isCheckMode) {
                unformattedFiles.push(displayPath)
              } else {
                writeFileSync(filePath, output, "utf-8")
                console.log(`Formatted: ${displayPath}`)
              }
              formattedCount++
            }
          } catch (error) {
            console.error(`Error formatting ${displayPath}:`, error)
          }
        }

        if (isCheckMode) {
          if (unformattedFiles.length > 0) {
            console.log(`\nThe following ${pluralize(unformattedFiles.length, 'file is', 'files are')} not formatted:`)
            unformattedFiles.forEach(file => console.log(`  ${file}`))
            console.log(`\nChecked ${files.length} ${pluralize(files.length, 'file')}, found ${unformattedFiles.length} unformatted ${pluralize(unformattedFiles.length, 'file')}`)

            process.exit(1)
          } else {
            console.log(`\nChecked ${files.length} ${pluralize(files.length, 'file')}, all files are properly formatted`)
          }
        } else {
          console.log(`\nChecked ${files.length} ${pluralize(files.length, 'file')}, formatted ${formattedCount} ${pluralize(formattedCount, 'file')}`)
        }
      }
    } catch (error) {
      console.error(error)

      process.exit(1)
    }
  }

  private async readStdin(): Promise<string> {
    const chunks: Buffer[] = []

    for await (const chunk of process.stdin) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
    }

    return Buffer.concat(chunks).toString("utf8")
  }

  private async resolvePatternToFiles(pattern: string, config: Config, isForceMode: boolean | undefined): Promise<string[]> {
    let isDirectory = false
    let isFile = false

    try {
      const stats = statSync(pattern)
      isDirectory = stats.isDirectory()
      isFile = stats.isFile()
    } catch {
      // Not a file/directory, treat as glob pattern
    }

    const filesConfig = config.getFilesConfigForTool('formatter')

    if (isDirectory) {
      const files = await config.findFilesForTool('formatter', resolve(pattern))
      return files
    } else if (isFile) {
      const testFiles = await glob(pattern, {
        cwd: process.cwd(),
        ignore: filesConfig.exclude || []
      })

      if (testFiles.length === 0) {
        if (!isForceMode) {
          console.error(`⚠️  File ${pattern} is excluded by configuration patterns.`)
          console.error(`   Use --force to format it anyway.\n`)
          process.exit(0)
        } else {
          console.error(`⚠️  Forcing formatter on excluded file: ${pattern}`)
          console.error()
          return [pattern]
        }
      }

      return [pattern]
    }

    const files = await glob(pattern, { ignore: filesConfig.exclude || [] })

    if (files.length === 0) {
      try {
        statSync(pattern)
      } catch {
        if (!pattern.includes('*') && !pattern.includes('?') && !pattern.includes('[') && !pattern.includes('{')) {
          throw new Error(`Cannot access '${pattern}': ENOENT: no such file or directory`)
        }
      }
    }

    return files
  }
}
