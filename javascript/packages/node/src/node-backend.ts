import packageJSON from "../package.json" with { type: "json" }

import { HerbBackend, Arena } from "@herb-tools/core"
import type { ArenaBackend, CreateArenaOptions } from "@herb-tools/core"

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

  toBackendOption(): { arena: any } {
    return { arena: this.nativeArena }
  }
}

export class HerbBackendNode extends HerbBackend {
  backendVersion(): string {
    return `${packageJSON.name}@${packageJSON.version}`
  }

  createArena(options?: CreateArenaOptions): Arena {
    this.ensureBackend()
    const nativeArena = new (this.backend as any).Arena(options)
    return new Arena(new NodeArenaBackend(nativeArena))
  }
}
