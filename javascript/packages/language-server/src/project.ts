import { Herb } from "@herb-tools/node-wasm"
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
  }

  async refresh() {
    // TODO
  }
}
