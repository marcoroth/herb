import { CLI } from './cli.js'

export async function handle(args: string[]): Promise<void> {
  const argv = ['node', 'herb-format', ...args]
  const originalArgv = process.argv
  process.argv = argv

  try {
    const formatter = new CLI()
    await formatter.run()
  } finally {
    process.argv = originalArgv
  }
}

export function helpInfo() {
  return {
    description: 'Format HTML+ERB templates',
    usage: [
      'herb format [pattern] [options]',
      'herb format index.html.erb',
      'herb format "templates/**/*.html.erb"',
      'herb format --check',
      'herb format --indent-width 4',
    ]
  }
}
