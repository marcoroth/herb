import { name, version } from "../package.json"

import { HerbBackend } from "@herb-tools/core"

export class HerbBackendNodeWASM extends HerbBackend {
  backendVersion(): string {
    return `${name}@${version}`
  }
}
