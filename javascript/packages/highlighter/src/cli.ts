import { readFileSync } from "fs"
import { parseArgs } from "util"
import { resolve } from "path"

import { Herb } from "@herb-tools/node-wasm"
import { Highlighter } from "./highlighter.js"

import { name, version } from "../package.json"

export class CLI {
  private usage = `
  Usage: herb-highlight [file] [options]

  Arguments:
    file             File to highlight (required)

  Options:
    -h, --help       show help
    -v, --version    show version
    --theme          color theme (default|bright|pastel) [default: default]
    --focus          line number to focus on (shows only that line with context)
    --context-lines  number of context lines around focus line [default: 2]
    --no-line-numbers hide line numbers and file path header
`

  private parseArguments() {
    const { values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
        theme: { type: 'string' },
        focus: { type: 'string' },
        'context-lines': { type: 'string' },
        'no-line-numbers': { type: 'boolean' }
      },
      allowPositionals: true
    })

    if (values.help) {
      console.log(this.usage)
      process.exit(0)
    }

    if (values.version) {
      console.log("Versions:")
      console.log(`  ${name}@${version}, ${Herb.version}`.split(", ").join("\n  "))
      process.exit(0)
    }

    const theme = values.theme || 'default'
    if (!['default', 'bright', 'pastel'].includes(theme)) {
      console.error(`Invalid theme: ${theme}. Valid themes: default, bright, pastel`)
      process.exit(1)
    }

    // Parse focus line
    let focusLine: number | undefined

    if (values.focus) {
      const parsed = parseInt(values.focus, 10)
      if (isNaN(parsed) || parsed < 1) {
        console.error(`Invalid focus line: ${values.focus}. Must be a positive integer.`)
        process.exit(1)
      }
      focusLine = parsed
    }

    // Parse context lines
    let contextLines = 2

    if (values['context-lines']) {
      const parsed = parseInt(values['context-lines'], 10)
      if (isNaN(parsed) || parsed < 0) {
        console.error(`Invalid context-lines: ${values['context-lines']}. Must be a non-negative integer.`)
        process.exit(1)
      }
      contextLines = parsed
    }

    const showLineNumbers = !values['no-line-numbers']

    return { values, positionals, theme, focusLine, contextLines, showLineNumbers }
  }

  async run() {
    const { positionals, theme, focusLine, contextLines, showLineNumbers } = this.parseArguments()

    if (positionals.length === 0) {
      console.error("Please specify an input file.")
      process.exit(1)
    }

    const filename = positionals[0]

    try {
      const filePath = resolve(filename)
      const content = readFileSync(filePath, "utf-8")

      const highlighter = new Highlighter(theme as 'default' | 'bright' | 'pastel')
      await highlighter.initialize()

      const highlighted = highlighter.highlight(filePath, content, {
        focusLine,
        contextLines: focusLine ? contextLines : 0,
        showLineNumbers
      })

      console.log(highlighted)

    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        console.error(`File not found: ${filename}`)
      } else {
        console.error(`Error:`, error)
      }

      process.exit(1)
    }
  }
}
