import { Herb } from "@herb-tools/node"
import { Connection } from "vscode-languageserver/node"

export class Project {
  connection: Connection
  projectPath: string

  constructor(connection: Connection, projectPath: string) {
    this.projectPath = projectPath
    this.connection = connection
  }

  async initialize() {
    await Herb.load()

    const result = Herb.parse("content")
    this.connection.console.log(result.inspect())
  }

  async refresh() {}
}
