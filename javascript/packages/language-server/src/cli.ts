import { Server } from "./server"

export class CLI {
  private usage = `
  Usage: herb-language-server [options]

  Options:
    --stdio          use stdio
    --node-ipc       use node-ipc
    --socket=<port>  use socket
`

  run() {
    if (process.argv.length <= 2) {
      console.error(`Error: Connection input stream is not set. Set command line parameters: '--node-ipc', '--stdio' or '--socket=<port>'`)
      console.error(this.usage)
      process.exit(1)
    }

    const server = new Server()
    server.listen()
  }
}
