export type HerbConfigOptions = {
  formatter?: {
    enabled?: boolean
    include?: string[]
    exclude?: string[]
    indentWidth?: number
    maxLineLength?: number
  }
}

export type HerbLSPConfig = {
  version: string
  createdAt: string
  updatedAt: string
  options: HerbConfigOptions
}

import path from "path"
import { version } from "../package.json"
import { promises as fs } from "fs"

export class Config {
  static configPath = ".herb-lsp/config.json"

  public readonly path: string
  public config: HerbLSPConfig

  constructor(projectPath: string, config: HerbLSPConfig) {
    this.path = Config.configPathFromProjectPath(projectPath)
    this.config = config
  }

  get version(): string {
    return this.config.version
  }

  get createdAt(): Date {
    return new Date(this.config.createdAt)
  }

  get updatedAt(): Date {
    return new Date(this.config.updatedAt)
  }

  get options(): HerbConfigOptions {
    return this.config.options
  }

  public toJSON() {
    return JSON.stringify(this.config, null, "  ")
  }

  private updateTimestamp() {
    this.config.updatedAt = new Date().toISOString()
  }

  private updateVersion() {
    this.config.version = version
  }

  async write() {
    this.updateVersion()
    this.updateTimestamp()

    const folder = path.dirname(this.path)

    fs.stat(folder)
      .then(() => {})
      .catch(async () => await fs.mkdir(folder))
      .finally(async () => await fs.writeFile(this.path, this.toJSON()))
  }

  async read() {
    return await fs.readFile(this.path, "utf8")
  }

  static configPathFromProjectPath(projectPath: string) {
    return path.join(projectPath, this.configPath)
  }

  static async fromPathOrNew(projectPath: string) {
    try {
      return await this.fromPath(projectPath)
    } catch (error: any) {
      return Config.newConfig(projectPath)
    }
  }

  static async fromPath(projectPath: string) {
    const configPath = Config.configPathFromProjectPath(projectPath)

    try {
      const config = JSON.parse(await fs.readFile(configPath, "utf8"))

      return new Config(projectPath, config)
    } catch (error: any) {
      throw new Error(`Error reading config file at: ${configPath}. Error: ${error.message}`)
    }
  }

  static newConfig(projectPath: string): Config {
    return new Config(projectPath, {
      version,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      options: {}
    })
  }
}
