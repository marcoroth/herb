#!/usr/bin/env node

import { Herb } from '@herb-tools/node-wasm'
import { args, type Arg } from './utils/args.js'
import { eprintln, println } from './utils/renderer.js'
import { help } from './commands/help/index.js'

declare const __VERSION__: string
const version = __VERSION__

const sharedOptions = {
  '--help': {
    type: 'boolean',
    description: 'Display usage information',
    alias: '-h'
  },
  '--version': {
    type: 'boolean',
    description: 'Display version information',
    alias: '-v'
  },
} satisfies Arg

const commandDescriptions: Record<string, string> = {
  lint: 'Lint HTML+ERB templates for errors and best practices',
  format: 'Format HTML+ERB templates',
  parse: 'Parse HTML+ERB templates and output the AST',
  lex: 'Tokenize HTML+ERB templates and output the token stream',
  print: 'Print HTML+ERB AST back to source code',
  highlight: 'Highlight HTML+ERB templates with syntax highlighting',
  lsp: 'Start the Herb language server',
  config: 'Manage Herb configuration files',
  playground: 'Open templates in the Herb playground',
}

async function main() {
  const rawArgs = process.argv.slice(2)
  const command = rawArgs[0]

  if (!command || command.startsWith('-')) {
    const flags = args(sharedOptions)

    if (flags['--version']) {
      await Herb.load()
      println(`herb v${version}`)
      println()
      println(`Tools:`)
      println(`  @herb-tools/cli@${version}`)
      println(`  @herb-tools/linter@${version}`)
      println(`  @herb-tools/formatter@${version}`)
      println(`  ${Herb.version}`.split(', ').join('\n  '))
      process.exit(0)
    }

    help({
      usage: ['herb <command> [options]'],
      commands: commandDescriptions,
      options: sharedOptions,
    })
    process.exit(0)
  }

  const commandHandlers: Record<string, () => Promise<any>> = {
    lint: () => import('./commands/lint/index.js'),
    format: () => import('./commands/format/index.js'),
    parse: () => import('./commands/parse/index.js'),
    lex: () => import('./commands/lex/index.js'),
    print: () => import('./commands/print/index.js'),
    highlight: () => import('./commands/highlight/index.js'),
    lsp: () => import('./commands/lsp/index.js'),
    config: () => import('./commands/config/index.js'),
    playground: () => import('./commands/playground/index.js'),
  }

  if (command in commandHandlers) {
    const cmd = await commandHandlers[command as keyof typeof commandHandlers]()
    await cmd.handle(rawArgs.slice(1))
  } else {
    help({
      invalid: command,
      usage: ['herb <command> [options]'],
      commands: commandDescriptions,
      options: sharedOptions,
    })
    process.exit(1)
  }
}

main().catch((error) => {
  eprintln(`Error: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
