import { readFileSync } from "node:fs"

import { name, version } from "../package.json"

import { Arena, HerbBackend, LexResult, ParseResult } from "@herb-tools/core"

import type { ArenaBackend, BackendArenaOption, CreateArenaOptions, LexOptions } from "@herb-tools/core"

class WASMArenaBackend implements ArenaBackend {
  private backend: any
  private arenaId: number

  constructor(backend: any, arenaId: number) {
    this.backend = backend
    this.arenaId = arenaId
  }

  get position(): number {
    return this.backend.arenaPosition(this.arenaId)
  }

  get capacity(): number {
    return this.backend.arenaCapacity(this.arenaId)
  }

  reset(): void {
    this.backend.resetArena(this.arenaId)
  }

  free(): void {
    this.backend.freeArena(this.arenaId)
  }

  toBackendOption(): BackendArenaOption {
    return { arenaId: this.arenaId }
  }
}

export class HerbBackendNodeWASM extends HerbBackend {
  lexFile(path: string, options?: LexOptions): LexResult {
    return this.lex(readFileSync(path, "utf-8"), options)
  }

  parseFile(path: string): ParseResult {
    return this.parse(readFileSync(path, "utf-8"))
  }

  backendVersion(): string {
    return `${name}@${version}`
  }

  createArena(options?: CreateArenaOptions): Arena {
    this.ensureBackend()
    const arenaId = (this.backend as any).createArena(options?.size ?? 0)
    return new Arena(new WASMArenaBackend(this.backend, arenaId))
  }
}
