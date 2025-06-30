import { Herb, HerbBackend } from "@herb-tools/node-wasm"
import { Connection } from "vscode-languageserver/node"

export class Project {
  connection: Connection
  projectPath: string
  herbBackend: HerbBackend

  constructor(connection: Connection, projectPath: string) {
    this.projectPath = projectPath
    this.connection = connection
    this.herbBackend = Herb
  }

  async initialize() {
    await this.herbBackend.load()
  }

  async refresh() {
    // TODO
  }
}
