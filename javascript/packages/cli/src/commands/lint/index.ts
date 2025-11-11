import { CLI } from './cli.js'

export async function handle(args: string[]): Promise<void> {
  const argv = ['node', 'herb-lint', ...args]

  const originalArgv = process.argv
  process.argv = argv

  try {
    const linter = new CLI()
    await linter.run()
  } finally {
    process.argv = originalArgv
  }
}

export function helpInfo() {
  return {
    description: 'Lint HTML+ERB templates for errors and best practices',
    usage: [
      'herb lint [pattern] [options]',
      'herb lint index.html.erb',
      'herb lint "templates/**/*.html.erb"',
      'herb lint --fix',
    ]
  }
}
