import { CLI } from './cli.js'

export async function handle(args: string[]): Promise<void> {
  const argv = ['node', 'herb-language-server', ...args]
  const originalArgv = process.argv
  process.argv = argv

  try {
    const server = new CLI()
    server.run()
  } finally {
    process.argv = originalArgv
  }
}

export function helpInfo() {
  return {
    description: 'Start the Herb language server',
    usage: [
      'herb lsp --stdio',
      'herb lsp --node-ipc',
      'herb lsp --socket=6009',
    ]
  }
}
