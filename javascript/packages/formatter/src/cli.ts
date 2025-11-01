import dedent from "dedent"
import { readFileSync, writeFileSync, statSync } from "fs"
import { glob } from "glob"
import { resolve, relative } from "path"

import { Herb } from "@herb-tools/node-wasm"
import { Config, addHerbExtensionRecommendation, getExtensionsJsonRelativePath } from "@herb-tools/config"

import { Formatter } from "./formatter.js"
import { parseArgs } from "util"

import { name, version, dependencies } from "../package.json"

const pluralize = (count: number, singular: string, plural: string = singular + 's'): string => {
  return count === 1 ? singular : plural
}

export class CLI {
  private usage = dedent`
    Usage: herb-format [file|directory|glob-pattern] [options]

    Arguments:
      file|directory|glob-pattern   File to format, directory to format all configured files within,
                                    glob pattern to match files, or '-' for stdin (omit to format all configured files in current directory)

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

      const file = positionals[0]
      const startPath = file || process.cwd()

      if (isInitMode) {
        const configPath = configFile || startPath

        if (Config.exists(configPath)) {
          const fullPath = configFile || Config.configPathFromProjectPath(startPath)
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

        const projectPath = configFile ? resolve(configFile) : startPath
        const projectDir = statSync(projectPath).isDirectory() ? projectPath : resolve(projectPath, '..')
        const extensionAdded = addHerbExtensionRecommendation(projectDir)

        console.log(`\n✓ Configuration initialized at ${config.path}`)

        if (extensionAdded) {
          console.log(`✓ VSCode extension recommended in ${getExtensionsJsonRelativePath()}`)
        }

        console.log(`  Formatter is enabled by default.`)
        console.log(`  Edit this file to customize linter and formatter settings.\n`)

        process.exit(0)
      }

      const config = await Config.loadForCLI(configFile || startPath, version)
      const formatterConfig = config.formatter || {}

      if (formatterConfig.enabled === false && !isForceMode) {
        console.log("Formatter is disabled in .herb.yml configuration.")
        console.log("To enable formatting, set formatter.enabled: true in .herb.yml")
        console.log("Or use --force to format anyway.")

        process.exit(0)
      }

      if (isForceMode && formatterConfig.enabled === false) {
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

      const { formatter, rewriterInfo } = await Formatter.from(Herb, config)

      if (rewriterInfo.preCount > 0 || rewriterInfo.postCount > 0) {
        const parts: string[] = []

        if (rewriterInfo.preCount > 0) {
          parts.push(`${rewriterInfo.preCount} pre-format ${pluralize(rewriterInfo.preCount, 'rewriter')}: ${rewriterInfo.preNames.join(', ')}`)
        }

        if (rewriterInfo.postCount > 0) {
          parts.push(`${rewriterInfo.postCount} post-format ${pluralize(rewriterInfo.postCount, 'rewriter')}: ${rewriterInfo.postNames.join(', ')}`)
        }

        console.error(`Using ${parts.join(', ')}`)
        console.error()
      }

      if (rewriterInfo.warnings.length > 0) {
        rewriterInfo.warnings.forEach(warning => console.error(`⚠️  ${warning}`))
        console.error()
      }

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
      } else if (file) {
        let isDirectory = false
        let isFile = false
        let pattern = file

        try {
          const stats = statSync(file)
          isDirectory = stats.isDirectory()
          isFile = stats.isFile()
        } catch {
          // Not a file/directory, treat as glob pattern
        }

        const filesConfig = config.getFilesConfigForTool('formatter')

        if (isDirectory) {
          const files = await config.findFilesForTool('formatter', resolve(file))

          if (files.length === 0) {
            console.log(`No files found in directory: ${resolve(file)}`)
            process.exit(0)
          }

          let formattedCount = 0
          let unformattedFiles: string[] = []

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
        } else if (isFile) {
          const testFiles = await glob(file, {
            cwd: process.cwd(),
            ignore: filesConfig.exclude || []
          })

          if (testFiles.length === 0) {
            if (!isForceMode) {
              console.error(`⚠️  File ${file} is excluded by configuration patterns.`)
              console.error(`   Use --force to format it anyway.\n`)
              process.exit(0)
            } else {
              console.error(`⚠️  Forcing formatter on excluded file: ${file}`)
              console.error()
            }
          }

          const source = readFileSync(file, "utf-8")
          const result = formatter.format(source)
          const output = result.endsWith('\n') ? result : result + '\n'

          if (output !== source) {
            if (isCheckMode) {
              console.log(`File is not formatted: ${file}`)
              process.exit(1)
            } else {
              writeFileSync(file, output, "utf-8")
              console.log(`Formatted: ${file}`)
            }
          } else if (isCheckMode) {
            console.log(`File is properly formatted: ${file}`)
          }

          process.exit(0)
        }

        try {
          const files = await glob(pattern, { ignore: filesConfig.exclude || [] })

          if (files.length === 0) {
            try {
              statSync(file)
            } catch {
              if (!file.includes('*') && !file.includes('?') && !file.includes('[') && !file.includes('{')) {
                console.error(`Error: Cannot access '${file}': ENOENT: no such file or directory`)

                process.exit(1)
              }
            }

            console.log(`No files found matching pattern: ${resolve(pattern)}`)

            process.exit(0)
          }

            let formattedCount = 0
            let unformattedFiles: string[] = []

            for (const filePath of files) {
              try {
                const source = readFileSync(filePath, "utf-8")
                const result = formatter.format(source)
                const output = result.endsWith('\n') ? result : result + '\n'

                if (output !== source) {
                  if (isCheckMode) {
                    unformattedFiles.push(filePath)
                  } else {
                    writeFileSync(filePath, output, "utf-8")
                    console.log(`Formatted: ${filePath}`)
                  }

                  formattedCount++
                }
              } catch (error) {
                console.error(`Error formatting ${filePath}:`, error)
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

        } catch (error) {
          console.error(`Error: Cannot access '${file}':`, error)

          process.exit(1)
        }
      } else {
        const files = await config.findFilesForTool('formatter', process.cwd())

        if (files.length === 0) {
          console.log(`No files found matching configured patterns`)

          process.exit(0)
        }

        let formattedCount = 0
        let unformattedFiles: string[] = []

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
}
