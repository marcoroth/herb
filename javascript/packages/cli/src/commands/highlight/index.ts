import { CLI } from './cli.js'

export async function handle(args: string[]): Promise<void> {
  const argv = ['node', 'herb-highlight', ...args]
  const originalArgv = process.argv
  process.argv = argv

  try {
    const highlighter = new CLI()
    await highlighter.run()
  } finally {
    process.argv = originalArgv
  }
}

export function helpInfo() {
  return {
    description: 'Highlight HTML+ERB templates with syntax highlighting',
    usage: [
      'herb highlight [file] [options]',
      'herb highlight input.html.erb',
      'herb highlight input.html.erb --theme dracula',
      'herb highlight input.html.erb --focus 42',
    ]
  }
}
