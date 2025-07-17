import { readFileSync, writeFileSync, statSync } from "fs"
import { glob } from "glob"
import { join, resolve } from "path"

import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "./formatter.js"

import { name, version } from "../package.json"

export class CLI {
  private usage = `
  Usage: herb-format [file|directory] [options]

  Arguments:
    file|directory   File to format, directory to format all **/*.html.erb files within,
                     or '-' for stdin (omit to format all **/*.html.erb files in current directory)

  Options:
    -h, --help       show help
    -v, --version    show version

  Examples:
    herb-format                            # Format all **/*.html.erb files in current directory
    herb-format templates/index.html.erb   # Format and write single file
    herb-format templates/                 # Format all **/*.html.erb files in templates directory
    cat template.html.erb | herb-format    # Format from stdin to stdout
    herb-format - < template.html.erb      # Format from stdin to stdout
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

      console.log("⚠️  Experimental Preview: The formatter is in early development. Please report any unexpected behavior or bugs to https://github.com/marcoroth/herb/issues")
      console.log()

      const formatter = new Formatter(Herb)

      const file = args.find(arg => !arg.startsWith("-"))

      if (!file && !process.stdin.isTTY) {
        const source = await this.readStdin()
        const result = formatter.format(source)

        process.stdout.write(result)
      } else if (file === "-") {
        const source = await this.readStdin()
        const result = formatter.format(source)

        process.stdout.write(result)
      } else if (file) {
        try {
          const stats = statSync(file)

          if (stats.isDirectory()) {
            const pattern = join(file, "**/*.html.erb")
            const files = await glob(pattern)

            if (files.length === 0) {
              console.log(`No files found matching pattern: ${resolve(pattern)}`)
              process.exit(0)
            }

            let formattedCount = 0

            for (const filePath of files) {
              try {
                const source = readFileSync(filePath, "utf-8")
                const result = formatter.format(source)
                if (result !== source) {
                  writeFileSync(filePath, result, "utf-8")
                  console.log(`Formatted: ${filePath}`)
                  formattedCount++
                }
              } catch (error) {
                console.error(`Error formatting ${filePath}:`, error)
              }
            }

            console.log(`\nChecked ${files.length} ${files.length === 1 ? 'file' : 'files'}, formatted ${formattedCount} ${formattedCount === 1 ? 'file' : 'files'}`)
          } else {
            const source = readFileSync(file, "utf-8")
            const result = formatter.format(source)

            if (result !== source) {
              writeFileSync(file, result, "utf-8")
              console.log(`Formatted: ${file}`)
            }
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

        for (const filePath of files) {
          try {
            const source = readFileSync(filePath, "utf-8")
            const result = formatter.format(source)
            if (result !== source) {
              writeFileSync(filePath, result, "utf-8")
              console.log(`Formatted: ${filePath}`)
              formattedCount++
            }
          } catch (error) {
            console.error(`Error formatting ${filePath}:`, error)
          }
        }

        console.log(`\nChecked ${files.length} ${files.length === 1 ? 'file' : 'files'}, formatted ${formattedCount} ${formattedCount === 1 ? 'file' : 'files'}`)
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
