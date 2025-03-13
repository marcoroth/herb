import packageJSON from "../package.json" with { type: "json" }

import { HerbBackend } from "@herb-tools/core"

export class HerbBackendNode extends HerbBackend {
  backendVersion(): string {
    return `${packageJSON.name}@${packageJSON.version}`
  }
}
