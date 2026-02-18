export interface ArenaBackend {
  position: number
  capacity: number
  reset(): void
  free(): void
  toBackendOption(): unknown
}

export class Arena {
  private backend: ArenaBackend

  constructor(backend: ArenaBackend) {
    this.backend = backend
  }

  get position(): number {
    return this.backend.position
  }

  get capacity(): number {
    return this.backend.capacity
  }

  reset(): this {
    this.backend.reset()
    return this
  }

  free(): void {
    this.backend.free()
  }

  toBackendOption(): unknown {
    return this.backend.toBackendOption()
  }
}
