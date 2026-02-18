import { readFileSync } from "node:fs"

import packageJSON from "../package.json" with { type: "json" }

import { Arena, HerbBackend, LexResult, ParseResult } from "@herb-tools/core"

import type { ArenaBackend, BackendArenaOption, CreateArenaOptions, LexOptions } from "@herb-tools/core"

class NodeArenaBackend implements ArenaBackend {
  private nativeArena: any

  constructor(nativeArena: any) {
    this.nativeArena = nativeArena
  }

  get position(): number {
    return this.nativeArena.position
  }

  get capacity(): number {
    return this.nativeArena.capacity
  }

  reset(): void {
    this.nativeArena.reset()
  }

  free(): void {
    this.nativeArena.free()
  }

  toBackendOption(): BackendArenaOption {
    return { arena: this.nativeArena }
  }
}

export class HerbBackendNode extends HerbBackend {
  lexFile(path: string, options?: LexOptions): LexResult {
    return this.lex(readFileSync(path, "utf-8"), options)
  }

  parseFile(path: string): ParseResult {
    return this.parse(readFileSync(path, "utf-8"))
  }

  backendVersion(): string {
    return `${packageJSON.name}@${packageJSON.version}`
  }

  createArena(options?: CreateArenaOptions): Arena {
    this.ensureBackend()
    const nativeArena = new (this.backend as any).Arena(options)
    return new Arena(new NodeArenaBackend(nativeArena))
  }
}
