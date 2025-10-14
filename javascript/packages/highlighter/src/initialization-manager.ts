import type { HerbBackend } from "@herb-tools/core"

export class InitializationManager {
  private _initialized = false
  private herb?: HerbBackend

  constructor(herb?: HerbBackend) {
    this.herb = herb
  }

  async initialize(): Promise<void> {
    if (this.herb) {
      await this.herb.load()
    }

    this._initialized = true
  }

  get initialized(): boolean {
    return this._initialized
  }

  requireInitialized(): void {
    if (!this._initialized) {
      throw new Error(
        "Highlighter must be initialized before use. Call await highlighter.initialize() first.",
      )
    }
  }
}
