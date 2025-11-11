import { CLI } from './cli.js'

export async function handle(args: string[]): Promise<void> {
  const argv = ['node', 'herb-print', ...args]
  const originalArgv = process.argv
  process.argv = argv

  try {
    const printer = new CLI()
    await printer.run()
  } finally {
    process.argv = originalArgv
  }
}

export function helpInfo() {
  return {
    description: 'Print HTML+ERB AST back to source code',
    usage: [
      'herb print [input] [options]',
      'herb print input.html.erb',
      'herb print -i input.html.erb -o output.html.erb',
      'herb print --glob --verify "app/views/**/*.html.erb"',
    ]
  }
}
