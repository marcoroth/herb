import { Connection } from "vscode-languageserver/node"
import { Project } from "./project"

export type SerializedTextDocument = {
  _uri: string
  _languageId: string
  _version: number
  _content: string
  _lineOffsets: number[]
}

export class Commands {
  private readonly project: Project
  private readonly connection: Connection

  constructor(project: Project, connection: Connection) {
    this.project = project
    this.connection = connection
  }
}
