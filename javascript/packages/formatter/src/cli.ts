import dedent from "dedent"
import { readFileSync, writeFileSync, statSync } from "fs"
import { glob } from "glob"
import { join, resolve } from "path"

import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "./formatter.js"

import { name, version } from "../package.json"

const pluralize = (count: number, singular: string, plural: string = singular + 's'): string => {
  return count === 1 ? singular : plural
}

export class CLI {
  private usage = dedent`
    Usage: herb-format [file|directory|glob-pattern] [options]

    Arguments:
      file|directory|glob-pattern   File to format, directory to format all **/*.html.erb files within,
                                    glob pattern to match files, or '-' for stdin (omit to format all **/*.html.erb files in current directory)

    Options:
      -c, --check      check if files are formatted without modifying them
      -h, --help       show help
      -v, --version    show version

    Examples:
      herb-format                            # Format all **/*.html.erb files in current directory
      herb-format index.html.erb             # Format and write single file
      herb-format templates/index.html.erb   # Format and write single file
      herb-format templates/                 # Format and **/*.html.erb within the given directory
      herb-format "templates/**/*.html.erb"  # Format all .html.erb files in templates directory using glob pattern
      herb-format "**/*.html.erb"            # Format all .html.erb files using glob pattern
      herb-format "**/*.xml.erb"             # Format all .xml.erb files using glob pattern
      herb-format --check                    # Check if all **/*.html.erb files are formatted
      herb-format --check templates/         # Check if all **/*.html.erb files in templates/ are formatted
      cat template.html.erb | herb-format    # Format from stdin to stdout
  `

  async run() {
    const args = process.argv.slice(2)

    if (args.includes("--help") || args.includes("-h")) {
      console.log(this.usage)

      process.exit(0)
    }

    try {
      await Herb.load()

      if (args.includes("--version") || args.includes("-v")) {
        console.log("Versions:")
        console.log(`  ${name}@${version}, ${Herb.version}`.split(", ").join("\n  "))

        process.exit(0)
      }

      console.log("⚠️  Experimental Preview: The formatter is in early development. Please report any unexpected behavior or bugs to https://github.com/marcoroth/herb/issues/new?template=formatting-issue.md")
      console.log()

      const formatter = new Formatter(Herb)
      const isCheckMode = args.includes("--check") || args.includes("-c")

      const file = args.find(arg => !arg.startsWith("-"))

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

        if (isDirectory) {
          pattern = join(file, "**/*.html.erb")
        } else if (isFile) {
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
          const files = await glob(pattern)

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
        const files = await glob("**/*.html.erb")

        if (files.length === 0) {
          console.log(`No files found matching pattern: ${resolve("**/*.html.erb")}`)

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
